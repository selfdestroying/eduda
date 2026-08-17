'use server'

import { NotFoundError } from '@/src/lib/error'
import { shopAction } from '@/src/lib/safe-action'
import { prisma } from '@repo/db'
import { CoinTxReason } from '@repo/db/enums'
import {
  AddToCartSchema,
  CheckoutSchema,
  RemoveCartItemSchema,
  SetCartItemQuantitySchema,
} from './schemas'
import type { CheckoutIssue } from './types'

/**
 * `Cart.studentId` уникален глобально, без `organizationId` в ключе — так эта
 * таблица устроена в схеме. Ученик принадлежит ровно одной школе, а `studentId`
 * сюда приходит из сессии, а не от клиента, поэтому чужую корзину этим не
 * достать. Чтение всё равно фильтруем по организации — правило «organizationId в
 * каждом where» дешевле соблюдать, чем объяснять исключения.
 */
async function findCart(studentId: number, organizationId: number) {
  return prisma.cart.findFirst({
    where: { studentId, organizationId },
    select: { id: true },
  })
}

type CartLine = {
  shopItemId: number
  name: string
  price: number
  quantity: number
  available: number
  archived: boolean
}

/**
 * Единственное место, где решается, можно ли покупать. Им пользуются и
 * предварительная проверка в `getCart`, и сама транзакция чекаута — иначе корзина
 * показывала бы одни правила, а чекаут применял другие.
 *
 * `total` считается ТОЛЬКО по покупаемым позициям: архивный или кончившийся
 * товар оплатить нельзя, и включать его в «нужно N коинов» — врать ученику.
 * `expectedPrice` передаёт чекаут: цены, которые клиент показал перед
 * подтверждением. В `getCart` сравнивать не с чем, снимка цены корзина не хранит.
 */
function classifyLine(item: CartLine, expectedPrice?: number): CheckoutIssue | null {
  if (item.archived) {
    return { kind: 'UNAVAILABLE', shopItemId: item.shopItemId, name: item.name }
  }
  if (item.available < item.quantity) {
    return {
      kind: 'OUT_OF_STOCK',
      shopItemId: item.shopItemId,
      name: item.name,
      available: item.available,
    }
  }
  if (expectedPrice !== undefined && expectedPrice !== item.price) {
    return {
      kind: 'PRICE_CHANGED',
      shopItemId: item.shopItemId,
      name: item.name,
      oldPrice: expectedPrice,
      newPrice: item.price,
    }
  }
  return null
}

function collectIssues(
  items: CartLine[],
  coins: number,
  expectedPrice?: Map<number, number>,
): { issues: CheckoutIssue[]; total: number } {
  const issues: CheckoutIssue[] = []
  let total = 0

  for (const item of items) {
    const issue = classifyLine(item, expectedPrice?.get(item.shopItemId))
    if (issue) issues.push(issue)
    // Подорожавший товар купить всё ещё можно — по новой цене, поэтому он
    // остаётся в сумме. Архивный и кончившийся — нет.
    if (!issue || issue.kind === 'PRICE_CHANGED') {
      total += item.price * item.quantity
    }
  }

  // `total > 0` обязателен: при отрицательном балансе (наследие данных) пустая
  // или целиком архивная корзина иначе жаловалась бы на нехватку нуля коинов.
  if (total > 0 && total > coins) {
    issues.push({ kind: 'INSUFFICIENT_COINS', needed: total, available: coins })
  }

  return { issues, total }
}

export const getCart = shopAction.metadata({ actionName: 'getCart' }).action(async ({ ctx }) => {
  const [cart, account] = await Promise.all([
    prisma.cart.findFirst({
      where: { studentId: ctx.student.id, organizationId: ctx.student.organizationId },
      select: {
        CartItem: {
          select: {
            quantity: true,
            shopItem: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                price: true,
                quantity: true,
                archivedAt: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    }),
    prisma.studentAccount.findFirst({
      where: { studentId: ctx.student.id, organizationId: ctx.student.organizationId },
      select: { coins: true },
    }),
  ])

  const coins = account?.coins ?? 0
  const items = (cart?.CartItem ?? []).map((item) => ({
    shopItemId: item.shopItem.id,
    name: item.shopItem.name,
    imageUrl: item.shopItem.imageUrl,
    price: item.shopItem.price,
    quantity: item.quantity,
    available: item.shopItem.quantity,
    archived: item.shopItem.archivedAt !== null,
  }))

  const { issues, total } = collectIssues(items, coins)

  return { items, total, coins, issues }
})

export const addToCart = shopAction
  .metadata({ actionName: 'addToCart' })
  .inputSchema(AddToCartSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { shopItemId, quantity } = parsedInput

    // Товар обязан принадлежать школе ученика и не быть архивным — иначе чужой
    // id, подставленный руками, попал бы в корзину.
    const shopItem = await prisma.shopItem.findFirst({
      where: {
        id: shopItemId,
        organizationId: ctx.student.organizationId,
        archivedAt: null,
      },
      select: { id: true },
    })
    if (!shopItem) throw new NotFoundError('Товар не найден')

    // Корзина создаётся лениво: у большинства учеников её просто нет.
    const cart = await prisma.cart.upsert({
      where: { studentId: ctx.student.id },
      create: { studentId: ctx.student.id, organizationId: ctx.student.organizationId },
      update: {},
      select: { id: true },
    })

    // Повторное добавление того же товара суммируется в одну строку — за это
    // отвечает @@unique([cartId, shopItemId]) (§11.14).
    await prisma.cartItem.upsert({
      where: { cartId_shopItemId: { cartId: cart.id, shopItemId } },
      create: {
        cartId: cart.id,
        shopItemId,
        quantity,
        organizationId: ctx.student.organizationId,
      },
      update: { quantity: { increment: quantity } },
    })
  })

export const setCartItemQuantity = shopAction
  .metadata({ actionName: 'setCartItemQuantity' })
  .inputSchema(SetCartItemQuantitySchema)
  .action(async ({ ctx, parsedInput }) => {
    const cart = await findCart(ctx.student.id, ctx.student.organizationId)
    if (!cart) throw new NotFoundError('Корзина пуста')

    await prisma.cartItem.updateMany({
      where: {
        cartId: cart.id,
        shopItemId: parsedInput.shopItemId,
        organizationId: ctx.student.organizationId,
      },
      data: { quantity: parsedInput.quantity },
    })
  })

export const removeCartItem = shopAction
  .metadata({ actionName: 'removeCartItem' })
  .inputSchema(RemoveCartItemSchema)
  .action(async ({ ctx, parsedInput }) => {
    const cart = await findCart(ctx.student.id, ctx.student.organizationId)
    if (!cart) return

    await prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        shopItemId: parsedInput.shopItemId,
        organizationId: ctx.student.organizationId,
      },
    })
  })

export const clearCart = shopAction
  .metadata({ actionName: 'clearCart' })
  .action(async ({ ctx }) => {
    const cart = await findCart(ctx.student.id, ctx.student.organizationId)
    if (!cart) return

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, organizationId: ctx.student.organizationId },
    })
  })

/** Внутренний сигнал «откатить транзакцию и вернуть весь список проблем разом». */
class CheckoutBlocked extends Error {
  constructor(readonly issues: CheckoutIssue[]) {
    super('checkout blocked')
  }
}

/**
 * Оформление заказа — единственная нетривиальная операция кабинета.
 *
 * Всё-или-ничего в одной транзакции. Цена и остаток перечитываются ВНУТРИ неё,
 * поэтому устаревший экран не может привести к покупке по старой цене. Списания
 * идут условными `updateMany` (`quantity >= qty`, `coins >= total`): если
 * `count !== 1`, кто-то успел раньше — бросаем и откатываем. Это же и есть
 * защита от двух одновременных чекаутов, без блокировок.
 *
 * При любых проблемах корзина остаётся нетронутой: список проблем возвращается
 * целиком, а не по первой (§8 SPEC).
 */
export const checkout = shopAction
  .metadata({ actionName: 'checkout' })
  .inputSchema(CheckoutSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id: studentId, organizationId } = ctx.student
    const expectedPrice = new Map(parsedInput.expected.map((e) => [e.shopItemId, e.price]))

    try {
      const orderId = await prisma.$transaction(async (tx) => {
        const cart = await tx.cart.findFirst({
          where: { studentId, organizationId },
          select: {
            id: true,
            CartItem: {
              select: {
                quantity: true,
                shopItem: {
                  select: { id: true, name: true, price: true, quantity: true, archivedAt: true },
                },
              },
            },
          },
        })

        if (!cart || cart.CartItem.length === 0) {
          throw new NotFoundError('Корзина пуста')
        }

        // Позиции упорядочены по shopItemId: блокировки строк товаров берутся в
        // одном и том же порядке во всех транзакциях, иначе два одновременных
        // чекаута с пересекающимися корзинами могут встать в дедлок.
        const items = cart.CartItem.map(({ quantity, shopItem }) => ({
          shopItemId: shopItem.id,
          name: shopItem.name,
          price: shopItem.price,
          quantity,
          available: shopItem.quantity,
          archived: shopItem.archivedAt !== null,
        })).sort((a, b) => a.shopItemId - b.shopItemId)

        const account = await tx.studentAccount.findFirst({
          where: { studentId, organizationId },
          select: { coins: true },
        })
        const coins = account?.coins ?? 0

        const { issues, total } = collectIssues(items, coins, expectedPrice)

        // Откат: заказ не создан, корзина не тронута, ученик видит все проблемы разом.
        if (issues.length > 0) {
          throw new CheckoutBlocked(issues)
        }

        // Списание остатков. Как только одна позиция не поддалась, заказ уже не
        // состоится — склад дальше не трогаем, но остальные позиции всё равно
        // перечитываем и классифицируем: ученик должен увидеть ВСЕ причины разом
        // (§8 SPEC), а не возвращаться за ними по одной.
        const failures: CheckoutIssue[] = []
        let debiting = true

        for (const item of items) {
          let mustExplain = false

          if (debiting) {
            const { count } = await tx.shopItem.updateMany({
              where: {
                id: item.shopItemId,
                organizationId,
                quantity: { gte: item.quantity },
                // Цена — часть условия, а не только остаток: под READ COMMITTED
                // между чтением выше и этим апдейтом её могли поменять в платформе,
                // и заказ ушёл бы по цене, которой уже нет.
                price: item.price,
              },
              data: { quantity: { decrement: item.quantity } },
            })
            if (count === 1) continue
            debiting = false
            mustExplain = true
          }

          const fresh = await tx.shopItem.findFirst({
            where: { id: item.shopItemId, organizationId },
            select: { name: true, price: true, quantity: true, archivedAt: true },
          })
          const line: CartLine = fresh
            ? {
                ...item,
                name: fresh.name,
                price: fresh.price,
                available: fresh.quantity,
                archived: fresh.archivedAt !== null,
              }
            : { ...item, available: 0, archived: true }

          // Сравниваем с ценой, прочитанной в начале транзакции: так ловится
          // подорожание, случившееся прямо под нами.
          const issue = classifyLine(line, item.price)
          if (issue) {
            failures.push(issue)
          } else if (mustExplain) {
            // Списание не прошло, а перечитанные данные уже выглядят нормально:
            // кто-то откатил своё изменение между двумя запросами. Заказ всё
            // равно не проводим — остаток не списан.
            failures.push({
              kind: 'OUT_OF_STOCK',
              shopItemId: item.shopItemId,
              name: line.name,
              available: line.available,
            })
          }
        }

        if (failures.length > 0) {
          throw new CheckoutBlocked(failures)
        }

        const spent = await tx.studentAccount.updateMany({
          where: { studentId, organizationId, coins: { gte: total } },
          data: { coins: { decrement: total } },
        })
        if (spent.count !== 1) {
          // Тот же приём: баланс успели потратить в другой вкладке — говорим
          // сколько нужно и сколько осталось, а не «не хватает».
          const fresh = await tx.studentAccount.findFirst({
            where: { studentId, organizationId },
            select: { coins: true },
          })
          throw new CheckoutBlocked([
            { kind: 'INSUFFICIENT_COINS', needed: total, available: fresh?.coins ?? 0 },
          ])
        }

        const order = await tx.order.create({
          data: {
            organizationId,
            studentId,
            status: 'PENDING',
            items: {
              create: items.map((item) => ({
                organizationId,
                shopItemId: item.shopItemId,
                quantity: item.quantity,
                priceAtPurchase: item.price,
              })),
            },
          },
          select: { id: true },
        })

        await tx.coinTransaction.create({
          data: {
            organizationId,
            studentId,
            amount: -total,
            reason: CoinTxReason.ORDER_PURCHASE,
            orderId: order.id,
          },
        })

        await tx.cartItem.deleteMany({ where: { cartId: cart.id, organizationId } })

        return order.id
      })

      return { ok: true as const, orderId }
    } catch (error) {
      if (error instanceof CheckoutBlocked) {
        return { ok: false as const, issues: error.issues }
      }
      throw error
    }
  })
