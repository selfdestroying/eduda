'use server'

import { prisma } from '@repo/db'
import { permissionAction } from '@/src/lib/safe-action'
import { CreateProductSchema, DeleteProductSchema, UpdateProductSchema } from './schemas'

/**
 * Прайс-лист школы. Права — те же, что у оплат: продукт это строка, из которой
 * собирается оплата, и отдельного ресурса под него в `permissions/organization.ts`
 * нет намеренно — новый statement пришлось бы раздать всем ролям ради того же
 * результата.
 */
export const getProducts = permissionAction({ payment: ['read'] })
  .metadata({ actionName: 'getProducts' })
  .action(async ({ ctx }) => {
    return await prisma.product.findMany({
      where: { organizationId: ctx.session.organizationId! },
      orderBy: { id: 'asc' },
    })
  })

/** Для формы оплаты: снятые с продажи продукты в новых оплатах не предлагаются. */
export const getActiveProducts = permissionAction({ payment: ['read'] })
  .metadata({ actionName: 'getActiveProducts' })
  .action(async ({ ctx }) => {
    return await prisma.product.findMany({
      where: { organizationId: ctx.session.organizationId!, isActive: true },
      orderBy: { name: 'asc' },
    })
  })

export const createProduct = permissionAction({ payment: ['create'] })
  .metadata({ actionName: 'createProduct' })
  .inputSchema(CreateProductSchema)
  .action(async ({ ctx, parsedInput }) => {
    // Возвращаем созданную строку: продукт заводят прямо из формы оплаты, и её
    // селекту нужен id, чтобы тут же его выбрать.
    return await prisma.product.create({
      data: { ...parsedInput, organizationId: ctx.session.organizationId! },
      select: { id: true, name: true, price: true, lessonCount: true },
    })
  })

export const updateProduct = permissionAction({ payment: ['update'] })
  .metadata({ actionName: 'updateProduct' })
  .inputSchema(UpdateProductSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.product.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

export const deleteProduct = permissionAction({ payment: ['delete'] })
  .metadata({ actionName: 'deleteProduct' })
  .inputSchema(DeleteProductSchema)
  .action(async ({ ctx, parsedInput }) => {
    // Оплаты продукт переживают: FK стоит на `SetNull`, а название у них своё —
    // снимок в `Payment.productName`.
    await prisma.product.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
