'use server'

import { NotFoundError } from '@/src/lib/error'
import { shopAction } from '@/src/lib/safe-action'
import { prisma } from '@repo/db'
import * as z from 'zod'

const PRODUCT_FIELDS = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  quantity: true,
  category: { select: { id: true, name: true } },
} as const

export const getCatalog = shopAction
  .metadata({ actionName: 'getCatalog' })
  .inputSchema(z.object({ categoryId: z.number().int().positive().optional() }))
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.shopItem.findMany({
      where: {
        organizationId: ctx.student.organizationId,
        archivedAt: null,
        ...(parsedInput.categoryId ? { categoryId: parsedInput.categoryId } : {}),
      },
      select: PRODUCT_FIELDS,
      orderBy: { id: 'asc' },
    })
  })

export const getCategories = shopAction
  .metadata({ actionName: 'getCategories' })
  .action(async ({ ctx }) => {
    return await prisma.category.findMany({
      where: {
        organizationId: ctx.student.organizationId,
        // Пустые категории в фильтре не нужны — по ним всё равно ничего не найдётся.
        shopItems: { some: { archivedAt: null } },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  })

/**
 * Архивированный товар и товар чужой школы дают ОДИН И ТОТ ЖЕ NOT_FOUND: разные
 * ответы позволили бы перебором узнать, что у соседней школы есть такой товар.
 */
export const getProduct = shopAction
  .metadata({ actionName: 'getProduct' })
  .inputSchema(z.object({ id: z.number().int().positive() }))
  .action(async ({ ctx, parsedInput }) => {
    // Оба запроса зависят только от входа и сессии, поэтому идут параллельно.
    // Второй считает, сколько этого товара уже в корзине: карточке это нужно,
    // чтобы не дать добавить сверх остатка, и дешевле посчитать здесь, чем
    // тянуть всю корзину запросом с клиента.
    const [product, cartItem] = await Promise.all([
      prisma.shopItem.findFirst({
        where: {
          id: parsedInput.id,
          organizationId: ctx.student.organizationId,
          archivedAt: null,
        },
        select: PRODUCT_FIELDS,
      }),
      prisma.cartItem.findFirst({
        where: {
          shopItemId: parsedInput.id,
          organizationId: ctx.student.organizationId,
          Cart: { studentId: ctx.student.id, organizationId: ctx.student.organizationId },
        },
        select: { quantity: true },
      }),
    ])

    if (!product) {
      throw new NotFoundError('Товар не найден')
    }

    return { ...product, inCart: cartItem?.quantity ?? 0 }
  })
