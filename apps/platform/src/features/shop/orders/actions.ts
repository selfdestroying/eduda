'use server'

import { Prisma, prisma } from '@repo/db'
import { CoinTxReason } from '@repo/db/enums'

import { recordCoins } from '@/src/lib/coins'
import { ConflictError } from '@/src/lib/error'
import { featureAction } from '@/src/lib/safe-action'
import { ChangeOrderStatusSchema, OrderListSchema } from './schemas'
import { ORDER_LIST_SELECT, type OrderListResult } from './types'

type OrderOrderBy = Prisma.OrderOrderByWithRelationInput

/**
 * Разрешённые колонки сортировки: id колонки таблицы → как её сортировать. Белый
 * список, а не подстановка поля из запроса: `sort` приходит из адресной строки.
 * Неизвестный ключ даёт порядок по умолчанию, без ошибки.
 *
 * Суммы здесь нет: она складывается из снимков цен в позициях, и такую SQL по
 * столбцу не отсортирует — порядок врал бы.
 */
const ORDER_ORDER_BY: Record<string, (dir: Prisma.SortOrder) => OrderOrderBy[]> = {
  student: (dir) => [{ student: { firstName: dir } }, { student: { lastName: dir } }],
  status: (dir) => [{ status: dir }],
  createdAt: (dir) => [{ createdAt: dir }],
}

/**
 * Порядок строк. Последним ключом всегда `id`: без него заказы, сделанные в одну
 * секунду, при листании переставляются местами.
 */
function resolveOrderOrderBy(sort: { id: string; desc: boolean } | null | undefined) {
  const build = sort ? ORDER_ORDER_BY[sort.id] : undefined
  if (!sort || !build) return [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
  return [...build(sort.desc ? 'desc' : 'asc'), { id: 'desc' as const }]
}

/**
 * Поиск по тому, что видно в строке: ученик и названия товаров.
 *
 * Слова требуются все, но каждое может найтись в любом поле — иначе «Иван Петров»
 * не нашёл бы никого: имя и фамилия лежат в разных колонках.
 */
function orderSearchWhere(search: string | undefined): Prisma.OrderWhereInput[] | undefined {
  const terms = search?.split(/\s+/).filter(Boolean) ?? []
  if (terms.length === 0) return undefined

  return terms.map((term) => {
    const contains = { contains: term, mode: 'insensitive' as const }
    return {
      OR: [
        { student: { firstName: contains } },
        { student: { lastName: contains } },
        { items: { some: { shopItem: { name: contains } } } },
      ],
    }
  })
}

export const getOrders = featureAction('shop')
  .metadata({ actionName: 'getOrders' })
  .inputSchema(OrderListSchema)
  .action(async ({ ctx, parsedInput }): Promise<OrderListResult> => {
    const { page, pageSize, sort, search, statuses } = parsedInput

    const where: Prisma.OrderWhereInput = {
      organizationId: ctx.session.organizationId!,
      ...(statuses.length > 0 && { status: { in: statuses } }),
      AND: orderSearchWhere(search),
    }

    // Одной транзакцией: строки и их количество обязаны быть посчитаны по одному и
    // тому же состоянию базы, иначе между запросами кто-то оформит заказ и
    // «страница 3 из 5» разъедется с тем, что реально вернулось.
    const [rows, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        select: ORDER_LIST_SELECT,
        orderBy: resolveOrderOrderBy(sort),
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ])

    return { rows, total }
  })

export const changeOrderStatus = featureAction('shop')
  .metadata({ actionName: 'changeOrderStatus' })
  .inputSchema(ChangeOrderStatusSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, newStatus } = parsedInput
    const organizationId = ctx.session.organizationId!

    // Возврат коинов, возврат остатка и смена статуса — одной транзакцией:
    // строка леджера обязана появиться вместе с изменением баланса.
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id, organizationId },
        include: { items: true },
      })

      await tx.order.update({
        where: { id, organizationId },
        data: { status: newStatus },
      })

      const wasCharged = order.status === 'PENDING' || order.status === 'COMPLETED'
      const isCharged = newStatus === 'PENDING' || newStatus === 'COMPLETED'
      if (wasCharged === isCharged) return

      // Сумма считается по снимку цены в позициях, а не по текущей цене товара:
      // вернуть надо ровно столько, сколько было списано.
      const total = order.items.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0)
      // Отмена возвращает коины и остаток, возврат из отмены — списывает обратно.
      const sign = isCharged ? -1 : 1

      for (const item of order.items) {
        if (sign > 0) {
          // Отмена: остаток просто возвращается.
          await tx.shopItem.update({
            where: { id: item.shopItemId, organizationId },
            data: { quantity: { increment: item.quantity } },
          })
          continue
        }
        // Возврат заказа из отмены снова забирает остаток — условным апдейтом,
        // иначе за время отмены школа могла распродать товар и остаток ушёл бы
        // в минус.
        const { count } = await tx.shopItem.updateMany({
          where: { id: item.shopItemId, organizationId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        })
        if (count !== 1) {
          throw new ConflictError('Товара из заказа больше нет в наличии — вернуть заказ нельзя')
        }
      }

      const { count } = await tx.studentAccount.updateMany({
        where: {
          studentId: order.studentId,
          organizationId,
          // Возврат заказа из отмены снова списывает коины — условно, иначе
          // потраченный возврат увёл бы баланс в минус.
          ...(isCharged ? { coins: { gte: total } } : {}),
        },
        data: { coins: { increment: sign * total } },
      })
      // Ноль строк — либо не хватило коинов, либо у ученика нет аккаунта. И то и
      // другое означает, что остаток уже сдвинут, а списания нет: откатываем всё,
      // чтобы склад не разъехался с леджером.
      if (count === 0) {
        throw new ConflictError(
          isCharged
            ? 'У ученика не хватает коинов, чтобы вернуть заказ в работу'
            : 'Не удалось вернуть коины: у ученика нет учётной записи',
        )
      }

      await recordCoins(tx, {
        organizationId,
        studentId: order.studentId,
        amount: sign * total,
        reason: isCharged ? CoinTxReason.ORDER_PURCHASE : CoinTxReason.ORDER_CANCELLED,
        orderId: order.id,
      })
    })
  })
