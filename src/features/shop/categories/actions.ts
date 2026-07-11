'use server'

import prisma from '@/src/lib/db/prisma'
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

export const deleteCategory = featureAction('shop')
  .metadata({ actionName: 'deleteCategory' })
  .inputSchema(DeleteCategorySchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.category.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
