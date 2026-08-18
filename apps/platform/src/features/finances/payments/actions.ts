'use server'

import { Prisma, prisma } from '@repo/db'
import {
  activatePackageTx,
  cancelPackageTx,
  unitPriceOf,
} from '@/src/features/finances/ledger.server'
import { loadPaymentProductTx } from '@/src/features/finances/products/resolve.server'
import { ConflictError, NotFoundError } from '@/src/lib/error'
import { todayYmdInTz } from '@/src/lib/timezone'
import { permissionAction } from '@/src/lib/safe-action'
import {
  CancelPaymentSchema,
  DeleteUnprocessedPaymentSchema,
  PackageListSchema,
  ResolveUnprocessedPaymentSchema,
  SellPackageSchema,
} from './schemas'
import { PACKAGE_LIST_SELECT, type PackageListResult } from './types'

/**
 * Оплата закрывает накопившиеся неоплаченные занятия, а каждое из них — отдельное
 * списание со своим пакетом, журналом и историей. У ученика, который долго ходил
 * без оплаты, таких занятий десятки, и в дефолтные пять секунд Prisma длинный
 * хвост не укладывается: транзакция откатится целиком, и оплата не пройдёт вовсе.
 */
const PAYMENT_TX_OPTIONS = { timeout: 30_000 }

/**
 * Разрешённые колонки сортировки: id колонки таблицы → как её сортировать. Каждая
 * запись — список полей, потому что одной колонке может соответствовать несколько:
 * в ячейке «Ученик» стоит «Имя Фамилия», и сортировка по одному `firstName`
 * оставила бы всех Иванов в произвольном порядке, хотя стрелка обещает алфавит.
 *
 * Белый список, а не подстановка поля из запроса: `sort` приходит из адресной
 * строки, то есть от пользователя. Неизвестный ключ (а в старых ссылках живут id
 * переименованных колонок) даёт порядок по умолчанию, без ошибки.
 */
/**
 * Разрешённые колонки сортировки: id колонки таблицы → как её сортировать. Каждая
 * запись — список полей, потому что одной колонке может соответствовать несколько:
 * в ячейке «Ученик» стоит «Имя Фамилия», и сортировка по одному `firstName`
 * оставила бы всех Иванов в произвольном порядке, хотя стрелка обещает алфавит.
 *
 * Белый список, а не подстановка поля из запроса: `sort` приходит из адресной
 * строки, то есть от пользователя. Неизвестный ключ (а в старых ссылках живут id
 * переименованных колонок) даёт порядок по умолчанию, без ошибки.
 */
const PACKAGE_ORDER_BY: Record<string, (dir: Prisma.SortOrder) => PackageOrderBy[]> = {
  student: (dir) => [{ student: { firstName: dir } }, { student: { lastName: dir } }],
  price: (dir) => [{ price: dir }],
  lessons: (dir) => [{ lessonCount: dir }],
  date: (dir) => [{ date: dir }],
  manager: (dir) => [{ manager: { name: dir } }],
  status: (dir) => [{ status: dir }],
}

type PackageOrderBy = Prisma.PackageOrderByWithRelationInput

/**
 * Порядок строк. Последним ключом всегда `id`: без него строки с равным значением
 * при листании переставляются местами, и один и тот же пакет успевает показаться
 * на двух страницах подряд.
 */
function resolveOrderBy(sort: { id: string; desc: boolean } | null | undefined): PackageOrderBy[] {
  const build = sort ? PACKAGE_ORDER_BY[sort.id] : undefined
  if (!sort || !build) return [{ date: 'desc' }, { id: 'desc' }]
  return [...build(sort.desc ? 'desc' : 'asc'), { id: 'desc' }]
}

/**
 * Условие по числовой колонке. Пустой диапазон не даёт ключа вовсе — `{}` в `where`
 * Prisma поняла бы как «поле есть», а не как «ограничения нет».
 */
function rangeWhere(
  field: 'price' | 'lessonCount',
  min: number | null | undefined,
  max: number | null | undefined,
): Prisma.PackageWhereInput {
  if (min == null && max == null) return {}
  return {
    [field]: { ...(min != null && { gte: min }), ...(max != null && { lte: max }) },
  }
}

/**
 * Поиск по тому, что видно в строке: ученик, продавец, продукт.
 *
 * Слова требуются все, но каждое может найтись в любом поле — иначе «Иван Петров»
 * не нашёл бы никого: имя и фамилия лежат в разных колонках, и `contains` по
 * каждой в отдельности не совпадёт с целой фразой. Заодно работает «Петров Иван».
 */
function searchWhere(search: string | undefined): Prisma.PackageWhereInput['AND'] {
  const terms = search?.split(/s+/).filter(Boolean) ?? []
  if (terms.length === 0) return undefined

  return terms.map((term) => ({
    OR: [
      { student: { firstName: { contains: term, mode: 'insensitive' as const } } },
      { student: { lastName: { contains: term, mode: 'insensitive' as const } } },
      { manager: { name: { contains: term, mode: 'insensitive' as const } } },
      { productName: { contains: term, mode: 'insensitive' as const } },
    ],
  }))
}

/** Список проданных пакетов: то, что школа продала, с деньгами на самом пакете. */
export const getPackages = permissionAction({ payment: ['read'] })
  .metadata({ actionName: 'getPackages' })
  .inputSchema(PackageListSchema)
  .action(async ({ ctx, parsedInput }): Promise<PackageListResult> => {
    const { page, pageSize, sort, search, from, to, managerIds, statuses } = parsedInput

    const where: Prisma.PackageWhereInput = {
      organizationId: ctx.session.organizationId!,
      AND: searchWhere(search),
      // Период — обычный необязательный фильтр, без подстановки текущего месяца:
      // страницу режет `skip`/`take`, и вся история стоит ровно столько же, сколько
      // один месяц. Границы включительные и сравниваются как строки — `date` это
      // date-only колонка `YYYY-MM-DD`, где лексикографический порядок совпадает с
      // хронологическим.
      ...((from || to) && {
        date: { ...(from && { gte: from }), ...(to && { lte: to }) },
      }),
      ...(managerIds.length > 0 && { managerId: { in: managerIds } }),
      ...(statuses.length > 0 && { status: { in: statuses } }),
      ...rangeWhere('price', parsedInput.priceMin, parsedInput.priceMax),
      ...rangeWhere('lessonCount', parsedInput.lessonsMin, parsedInput.lessonsMax),
    }

    // Одной транзакцией: строки и их количество обязаны быть посчитаны по одному и
    // тому же состоянию базы, иначе между запросами проходит продажа и «страница 3
    // из 5» разъезжается с тем, что реально вернулось.
    const [rows, total] = await prisma.$transaction([
      prisma.package.findMany({
        where,
        select: PACKAGE_LIST_SELECT,
        orderBy: resolveOrderBy(sort),
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.package.count({ where }),
    ])

    return { rows, total }
  })
/**
 * Продажа пакета: заводит счёт и пакет одной парой. Уроки выдаёт только если
 * деньги уже получены — иначе счёт остаётся ждать подтверждения.
 */
export const sellPackage = permissionAction({ payment: ['create'] })
  .metadata({ actionName: 'sellPackage' })
  .inputSchema(SellPackageSchema)
  .action(async ({ ctx, parsedInput }) => {
    const {
      studentId,
      walletId,
      lessonCount,
      price,
      date,
      paymentMethodId,
      productId,
      managerId,
      received,
    } = parsedInput

    await prisma.$transaction(async (tx) => {
      const product = await loadPaymentProductTx(tx, productId, ctx.session.organizationId!)

      // Кошелёк ищем в своей организации: `walletId` приходит из запроса, и без
      // этого условия чужой id нашёлся бы, а пакет лёг бы в чужую школу —
      // `organizationId` для него брался из самого кошелька.
      const wallet = await tx.wallet.findFirst({
        where: { id: walletId, organizationId: ctx.session.organizationId! },
        select: { studentId: true, status: true },
      })
      if (!wallet) throw new NotFoundError('Кошелёк не найден')
      if (wallet.studentId !== studentId)
        throw new ConflictError('Кошелёк не принадлежит этому ученику')
      // Архивный кошелёк из интерфейса не выбрать, но запросом — можно.
      if (wallet.status !== 'ACTIVE') throw new ConflictError('Кошелёк архивирован')

      // Счёт: деньги. Уроков он не знает — они на пакете.
      const payment = await tx.payment.create({
        select: { id: true },
        data: {
          organizationId: ctx.session.organizationId!,
          price,
          date,
          status: received ? 'ACTIVE' : 'PENDING',
          paymentMethodId: paymentMethodId ?? null,
        },
      })

      // Пакет: уроки. Пока счёт не подтверждён, лежит `PENDING` — в очередь не
      // встаёт и баланса не двигает.
      const packet = await tx.package.create({
        select: { id: true },
        data: {
          organizationId: ctx.session.organizationId!,
          studentId,
          walletId,
          paymentId: payment.id,
          managerId: managerId ?? null,
          lessonCount,
          remaining: lessonCount,
          price,
          unitPrice: unitPriceOf({ price, lessonCount }),
          date,
          productId: product.id,
          // Снимок названия: продукт потом переименуют или удалят, а подпись этого
          // пакета обязана остаться прежней.
          productName: product.name,
        },
      })

      // Деньги уже в руках — выдаём уроки тем же движением: для администратора с
      // наличными создание и подтверждение это один шаг.
      if (received) {
        await activatePackageTx(tx, {
          packageId: packet.id,
          organizationId: ctx.session.organizationId!,
          actorUserId: Number(ctx.session.user.id),
        })
      }
    }, PAYMENT_TX_OPTIONS)
  })

/**
 * Деньги по счёту получены: выдаёт его пакеты.
 *
 * Отдельная операция, потому что счёт можно выставить заранее — менеджер продаёт
 * пакет, родитель платит позже. Уроки появляются здесь, а не при продаже.
 */
export const confirmPayment = permissionAction({ payment: ['update'] })
  .metadata({ actionName: 'confirmPayment' })
  .inputSchema(CancelPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
        select: { id: true, status: true, packages: { select: { id: true } } },
      })
      if (!payment) throw new NotFoundError('Оплата не найдена')
      if (payment.status === 'CANCELLED') throw new ConflictError('Оплата отменена')
      if (payment.status === 'ACTIVE') throw new ConflictError('Оплата уже подтверждена')

      await tx.payment.update({ where: { id: payment.id }, data: { status: 'ACTIVE' } })

      for (const packet of payment.packages) {
        await activatePackageTx(tx, {
          packageId: packet.id,
          organizationId: ctx.session.organizationId!,
          actorUserId: Number(ctx.session.user.id),
        })
      }
    }, PAYMENT_TX_OPTIONS)
  })

/**
 * Отмена пакета: снимает с баланса непотраченный остаток.
 *
 * Отдельно от отмены оплаты: деньги и уроки — разные вещи. Вернуть деньги, оставив
 * уроки, законно, и наоборот тоже.
 */
export const cancelPackage = permissionAction({ payment: ['delete'] })
  .metadata({ actionName: 'cancelPackage' })
  .inputSchema(CancelPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.$transaction(async (tx) => {
      const packet = await tx.package.findFirst({
        where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
        select: { status: true },
      })
      if (!packet) throw new NotFoundError('Пакет не найден')
      if (packet.status === 'CANCELLED') throw new ConflictError('Пакет уже отменён')

      await cancelPackageTx(tx, {
        packageId: parsedInput.id,
        organizationId: ctx.session.organizationId!,
        actorUserId: Number(ctx.session.user.id),
        effectiveAt: todayYmdInTz(ctx.tz),
      })
    }, PAYMENT_TX_OPTIONS)
  })

export const cancelPayment = permissionAction({ payment: ['delete'] })
  .metadata({ actionName: 'cancelPayment' })
  .inputSchema(CancelPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
        select: { id: true, status: true, packages: { select: { id: true, status: true } } },
      })
      if (!payment) throw new NotFoundError('Оплата не найдена')
      if (payment.status === 'CANCELLED') throw new ConflictError('Оплата уже отменена')

      // Запись не удаляем: на её пакеты ссылаются проводки проведённых занятий, и
      // исчезновение оплаты переписало бы выручку прошлых месяцев.
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      })

      // Отменяется только счёт. Выданные пакеты остаются на балансе: уроки ученику
      // отдали, и снимать их — отдельное решение (`cancelPackage`). А вот
      // невыданные закрываются вместе со счётом: без денег они и не появятся.
      for (const packet of payment.packages) {
        if (packet.status !== 'PENDING') continue
        await cancelPackageTx(tx, {
          packageId: packet.id,
          organizationId: ctx.session.organizationId!,
          actorUserId: Number(ctx.session.user.id),
          effectiveAt: todayYmdInTz(ctx.tz),
        })
      }
    })
  })

export const getUnprocessedPayments = permissionAction({ payment: ['read'] })
  .metadata({ actionName: 'getUnprocessedPayments' })
  .action(async ({ ctx }) => {
    return await prisma.unprocessedPayment.findMany({
      where: { organizationId: ctx.session.organizationId! },
      orderBy: { createdAt: 'desc' },
    })
  })

// Разбор неразобранной оплаты создаёт настоящую пару «счёт + пакет» — право то же,
// что у создания вручную.
export const resolveUnprocessedPayment = permissionAction({ payment: ['create'] })
  .metadata({ actionName: 'resolveUnprocessedPayment' })
  .inputSchema(ResolveUnprocessedPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const {
      unprocessedPaymentId,
      studentId,
      walletId,
      lessonCount,
      price,
      date,
      paymentMethodId,
      productId,
      managerId,
      received,
    } = parsedInput

    await prisma.$transaction(async (tx) => {
      const product = await loadPaymentProductTx(tx, productId, ctx.session.organizationId!)

      const wallet = await tx.wallet.findFirst({
        where: { id: walletId, organizationId: ctx.session.organizationId! },
        select: { studentId: true, status: true },
      })
      if (!wallet) throw new NotFoundError('Кошелёк не найден')
      if (wallet.studentId !== studentId)
        throw new ConflictError('Кошелёк не принадлежит этому ученику')
      if (wallet.status !== 'ACTIVE') throw new ConflictError('Кошелёк архивирован')

      const payment = await tx.payment.create({
        select: { id: true },
        data: {
          organizationId: ctx.session.organizationId!,
          price,
          date,
          status: received ? 'ACTIVE' : 'PENDING',
          paymentMethodId: paymentMethodId ?? null,
        },
      })

      const packet = await tx.package.create({
        select: { id: true },
        data: {
          organizationId: ctx.session.organizationId!,
          studentId,
          walletId,
          paymentId: payment.id,
          managerId: managerId ?? null,
          lessonCount,
          remaining: lessonCount,
          price,
          unitPrice: unitPriceOf({ price, lessonCount }),
          date,
          productId: product.id,
          productName: product.name,
        },
      })

      await tx.unprocessedPayment.update({
        where: { id: unprocessedPaymentId, organizationId: ctx.session.organizationId! },
        data: { resolved: true },
      })

      if (received) {
        await activatePackageTx(tx, {
          packageId: packet.id,
          organizationId: ctx.session.organizationId!,
          actorUserId: Number(ctx.session.user.id),
          meta: { unprocessedPaymentId },
        })
      }
    }, PAYMENT_TX_OPTIONS)
  })

export const deleteUnprocessedPayment = permissionAction({ payment: ['delete'] })
  .metadata({ actionName: 'deleteUnprocessedPayment' })
  .inputSchema(DeleteUnprocessedPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.unprocessedPayment.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
