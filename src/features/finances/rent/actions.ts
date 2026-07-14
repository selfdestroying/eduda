'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { addDays } from 'date-fns'
import { CreateRentSchema, DeleteRentSchema, UpdateRentSchema } from './schemas'

const pad = (n: number) => String(n).padStart(2, '0')
/** Date → `YYYY-MM-DD` по UTC-компонентам. */
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

type PeriodInput = {
  isMonthly: boolean
  startDate?: string
  endDate?: string
  month?: number
  year?: number
}

/** Границы аренды как date-only строки `YYYY-MM-DD`. */
function resolvePeriod(input: PeriodInput): { startDate: string; endDate: string | null } {
  if (input.isMonthly) {
    const year = input.year!
    const month = input.month!
    return {
      // Start of contract: first day of chosen month/year
      startDate: `${year}-${pad(month + 1)}-01`,
      // Monthly recurring: open-ended
      endDate: null,
    }
  }
  return {
    startDate: input.startDate!,
    endDate: input.endDate!,
  }
}

export const getRents = authAction.metadata({ actionName: 'getRents' }).action(async ({ ctx }) => {
  return await prisma.rent.findMany({
    where: {
      organizationId: ctx.session.organizationId!,
    },
    include: { location: true },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  })
})

export const createRent = authAction
  .metadata({ actionName: 'createRent' })
  .inputSchema(CreateRentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { startDate, endDate } = resolvePeriod(parsedInput)
    await prisma.$transaction(async (tx) => {
      // Auto-close previous open-ended rows that start before this one
      if (!endDate) {
        await tx.rent.updateMany({
          where: {
            organizationId: ctx.session.organizationId!,
            locationId: parsedInput.locationId,
            endDate: null,
            startDate: { lt: startDate },
          },
          data: { endDate: ymd(addDays(new Date(`${startDate}T00:00:00Z`), -1)) },
        })
      }
      await tx.rent.create({
        data: {
          locationId: parsedInput.locationId,
          amount: parsedInput.amount,
          comment: parsedInput.comment,
          isMonthly: parsedInput.isMonthly,
          startDate,
          endDate,
          organizationId: ctx.session.organizationId!,
        },
      })
    })
  })

export const updateRent = authAction
  .metadata({ actionName: 'updateRent' })
  .inputSchema(UpdateRentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, locationId, amount, comment, isMonthly } = parsedInput
    const { startDate, endDate } = resolvePeriod(parsedInput)
    await prisma.rent.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data: {
        locationId,
        amount,
        comment,
        isMonthly,
        startDate,
        endDate,
      },
    })
  })

export const deleteRent = authAction
  .metadata({ actionName: 'deleteRent' })
  .inputSchema(DeleteRentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.rent.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
