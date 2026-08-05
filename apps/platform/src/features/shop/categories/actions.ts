'use server'

import { prisma } from '@repo/db'
import { ConflictError } from '@/src/lib/error'
import { CreateCategorySchema, DeleteCategorySchema, UpdateCategorySchema } from './schemas'
import { featureAction } from '@/src/lib/safe-action'

export const getCategories = featureAction('shop')
  .metadata({ actionName: 'getCategories' })
  .action(async ({ ctx }) => {
    return await prisma.category.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
      },
      orderBy: { id: 'asc' },
    })
  })

export const createCategory = featureAction('shop')
  .metadata({ actionName: 'createCategory' })
  .inputSchema(CreateCategorySchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.category.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updateCategory = featureAction('shop')
  .metadata({ actionName: 'updateCategory' })
  .inputSchema(UpdateCategorySchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.category.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

/**
 * Категорию можно удалить, только пока в ней нет товаров.
 *
 * `Product.category` — каскад, поэтому раньше удаление категории тихо сносило
 * её товары вместе с заказами. Теперь `OrderItem.product` стоит на `Restrict`,
 * и такой каскад упирается в невнятную ошибку БД, а товары без заказов всё ещё
 * стирались бы физически — ровно то, ради чего вводился `archivedAt`.
 * Поэтому проверяем заранее и объясняем, что делать.
 */
export const deleteCategory = featureAction('shop')
  .metadata({ actionName: 'deleteCategory' })
  .inputSchema(DeleteCategorySchema)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = ctx.session.organizationId!

    const products = await prisma.product.count({
      where: { categoryId: parsedInput.id, organizationId },
    })
    if (products > 0) {
      throw new ConflictError(
        'В категории есть товары. Перенесите их в другую категорию или архивируйте.',
      )
    }

    await prisma.category.delete({
      where: { id: parsedInput.id, organizationId },
    })
  })
