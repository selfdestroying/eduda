'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import {
  CreatePaymentMethodSchema,
  DeletePaymentMethodSchema,
  UpdatePaymentMethodSchema,
} from './schemas'

export const getPaymentMethods = authAction
  .metadata({ actionName: 'getPaymentMethods' })
  .action(async ({ ctx }) => {
    return await prisma.paymentMethod.findMany({
      where: { organizationId: ctx.session.organizationId! },
      orderBy: { id: 'asc' },
    })
  })

export const getActivePaymentMethods = authAction
  .metadata({ actionName: 'getActivePaymentMethods' })
  .action(async ({ ctx }) => {
    return await prisma.paymentMethod.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    })
  })

export const createPaymentMethod = authAction
  .metadata({ actionName: 'createPaymentMethod' })
  .inputSchema(CreatePaymentMethodSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.paymentMethod.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updatePaymentMethod = authAction
  .metadata({ actionName: 'updatePaymentMethod' })
  .inputSchema(UpdatePaymentMethodSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.paymentMethod.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

export const deletePaymentMethod = authAction
  .metadata({ actionName: 'deletePaymentMethod' })
  .inputSchema(DeletePaymentMethodSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.paymentMethod.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
