'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { CreateExpenseSchema, DeleteExpenseSchema, UpdateExpenseSchema } from './schemas'

export const getExpenses = authAction
  .metadata({ actionName: 'getExpenses' })
  .action(async ({ ctx }) => {
    return await prisma.expense.findMany({
      where: { organizationId: ctx.session.organizationId! },
      orderBy: { date: 'desc' },
    })
  })

export const createExpense = authAction
  .metadata({ actionName: 'createExpense' })
  .inputSchema(CreateExpenseSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.expense.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updateExpense = authAction
  .metadata({ actionName: 'updateExpense' })
  .inputSchema(UpdateExpenseSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.expense.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

export const deleteExpense = authAction
  .metadata({ actionName: 'deleteExpense' })
  .inputSchema(DeleteExpenseSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.expense.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
