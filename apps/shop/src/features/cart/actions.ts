'use server'

import { NotFoundError } from '@/src/lib/error'
import { shopAction } from '@/src/lib/safe-action'
import { prisma } from '@repo/db'
import { AddToCartSchema, RemoveCartItemSchema, SetCartItemQuantitySchema } from './schemas'
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
