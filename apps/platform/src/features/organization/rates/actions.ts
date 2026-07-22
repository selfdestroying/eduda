'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { todayYmdInTz } from '@/src/lib/timezone'
import { CreateRateSchema, DeleteRateSchema, UpdateRateSchema } from './schemas'

export const getRates = authAction.metadata({ actionName: 'getRates' }).action(async ({ ctx }) => {
  return await prisma.rate.findMany({
    where: { organizationId: ctx.session.organizationId! },
    include: { _count: { select: { teacherGroups: true } } },
    orderBy: { name: 'asc' },
  })
})

export const createRate = authAction
  .metadata({ actionName: 'createRate' })
  .inputSchema(CreateRateSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.rate.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updateRate = authAction
  .metadata({ actionName: 'updateRate' })
  .inputSchema(UpdateRateSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, isApplyToLessons, ...data } = parsedInput

    await prisma.$transaction(async (tx) => {
      const rate = await tx.rate.update({
        where: { id, organizationId: ctx.session.organizationId! },
        data,
      })

      if (isApplyToLessons) {
        const teacherGroups = await tx.teacherGroup.findMany({
          where: { rateId: rate.id },
          select: { teacherId: true, groupId: true },
        })

        for (const tg of teacherGroups) {
          await tx.teacherLesson.updateMany({
            where: {
              teacherId: tg.teacherId,
              lesson: {
                date: { gt: todayYmdInTz(ctx.tz) },
                groupId: tg.groupId,
              },
            },
            data: {
              bid: rate.bid,
              bonusPerStudent: rate.bonusPerStudent,
            },
          })
        }
      }
    })
  })

export const deleteRate = authAction
  .metadata({ actionName: 'deleteRate' })
  .inputSchema(DeleteRateSchema)
  .action(async ({ ctx, parsedInput }) => {
    const rate = await prisma.rate.findUnique({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      include: { _count: { select: { teacherGroups: true, groupTypes: true } } },
    })

    if (rate && rate._count.groupTypes > 0) {
      throw new Error('Невозможно удалить ставку, которая привязана к типу группы')
    }

    await prisma.rate.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
