'use server'

import { ConflictError, NotFoundError } from '@/src/lib/error'
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

export const getCart = shopAction.metadata({ actionName: 'getCart' }).action(async ({ ctx }) => {
  const [cart, account] = await Promise.all([
    prisma.cart.findFirst({
      where: { studentId: ctx.student.id, organizationId: ctx.student.organizationId },
      select: {
        CartItem: {
          select: {
            quantity: true,
            Product: {
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
    productId: item.Product.id,
    name: item.Product.name,
    imageUrl: item.Product.imageUrl,
    price: item.Product.price,
    quantity: item.quantity,
    available: item.Product.quantity,
    archived: item.Product.archivedAt !== null,
  }))

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const issues: CheckoutIssue[] = []
  for (const item of items) {
    if (item.archived) {
      issues.push({ kind: 'UNAVAILABLE', productId: item.productId, name: item.name })
    } else if (item.available < item.quantity) {
      issues.push({
        kind: 'OUT_OF_STOCK',
        productId: item.productId,
        name: item.name,
        available: item.available,
      })
    }
  }
  if (items.length > 0 && total > coins) {
    issues.push({ kind: 'INSUFFICIENT_COINS', needed: total, available: coins })
  }

  return { items, total, coins, issues }
})

export const addToCart = shopAction
  .metadata({ actionName: 'addToCart' })
  .inputSchema(AddToCartSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { productId, quantity } = parsedInput

    // Товар обязан принадлежать школе ученика и не быть архивным — иначе чужой
    // id, подставленный руками, попал бы в корзину.
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: ctx.student.organizationId,
        archivedAt: null,
      },
      select: { id: true },
    })
    if (!product) throw new NotFoundError('Товар не найден')

    // Корзина создаётся лениво: у большинства учеников её просто нет.
    const cart = await prisma.cart.upsert({
      where: { studentId: ctx.student.id },
      create: { studentId: ctx.student.id, organizationId: ctx.student.organizationId },
      update: {},
      select: { id: true },
    })

    // Повторное добавление того же товара суммируется в одну строку — за это
    // отвечает @@unique([cartId, productId]) (§11.14).
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: {
        cartId: cart.id,
        productId,
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
        productId: parsedInput.productId,
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
        productId: parsedInput.productId,
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
    const expectedPrice = new Map(parsedInput.expected.map((e) => [e.productId, e.price]))

    try {
      const orderId = await prisma.$transaction(async (tx) => {
        const cart = await tx.cart.findFirst({
          where: { studentId, organizationId },
          select: {
            id: true,
            CartItem: {
              select: {
                quantity: true,
                Product: {
                  select: { id: true, name: true, price: true, quantity: true, archivedAt: true },
                },
              },
            },
          },
        })

        const items = cart?.CartItem ?? []
        if (!cart || items.length === 0) {
          throw new NotFoundError('Корзина пуста')
        }

        const account = await tx.studentAccount.findFirst({
          where: { studentId, organizationId },
          select: { coins: true },
        })
        const coins = account?.coins ?? 0

        const issues: CheckoutIssue[] = []
        let total = 0

        for (const { quantity, Product: product } of items) {
          total += product.price * quantity

          if (product.archivedAt !== null) {
            issues.push({ kind: 'UNAVAILABLE', productId: product.id, name: product.name })
            continue
          }
          if (product.quantity < quantity) {
            issues.push({
              kind: 'OUT_OF_STOCK',
              productId: product.id,
              name: product.name,
              available: product.quantity,
            })
            continue
          }
          const shown = expectedPrice.get(product.id)
          if (shown !== undefined && shown !== product.price) {
            issues.push({
              kind: 'PRICE_CHANGED',
              productId: product.id,
              name: product.name,
              oldPrice: shown,
              newPrice: product.price,
            })
          }
        }

        if (total > coins) {
          issues.push({ kind: 'INSUFFICIENT_COINS', needed: total, available: coins })
        }

        // Откат: заказ не создан, корзина не тронута, ученик видит все проблемы разом.
        if (issues.length > 0) {
          throw new CheckoutBlocked(issues)
        }

        for (const { quantity, Product: product } of items) {
          const { count } = await tx.product.updateMany({
            where: { id: product.id, organizationId, quantity: { gte: quantity } },
            data: { quantity: { decrement: quantity } },
          })
          if (count !== 1) {
            throw new ConflictError(`«${product.name}» разобрали, пока вы оформляли заказ`)
          }
        }

        const spent = await tx.studentAccount.updateMany({
          where: { studentId, organizationId, coins: { gte: total } },
          data: { coins: { decrement: total } },
        })
        if (spent.count !== 1) {
          throw new ConflictError('Не хватает коинов')
        }

        const order = await tx.order.create({
          data: {
            organizationId,
            studentId,
            status: 'PENDING',
            items: {
              create: items.map(({ quantity, Product: product }) => ({
                organizationId,
                productId: product.id,
                quantity,
                priceAtPurchase: product.price,
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
