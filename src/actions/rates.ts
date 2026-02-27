'use server'

import prisma from '@/src/lib/prisma'
import { normalizeDateOnly, moscowNow } from '@/src/lib/timezone'
import { revalidatePath } from 'next/cache'
import { Prisma } from '../../prisma/generated/client'

export const getRates = async <T extends Prisma.RateFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.RateFindManyArgs>
) => {
  return await prisma.rate.findMany<T>(payload)
}

export const getRate = async <T extends Prisma.RateFindFirstArgs>(
  payload: Prisma.SelectSubset<T, Prisma.RateFindFirstArgs>
) => {
  return await prisma.rate.findFirst(payload)
}

export const createRate = async (payload: Prisma.RateCreateArgs) => {
  await prisma.rate.create(payload)
  revalidatePath('/dashboard')
}

export const updateRate = async (payload: Prisma.RateUpdateArgs, isApplyToLessons: boolean) => {
  await prisma.$transaction(async (tx) => {
    const rate = await tx.rate.update(payload)

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
              date: { gt: normalizeDateOnly(moscowNow()) },
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

  revalidatePath('/dashboard')
}

export const deleteRate = async (payload: Prisma.RateDeleteArgs) => {
  const rate = await prisma.rate.findUnique({
    where: payload.where,
    include: { _count: { select: { teacherGroups: true, groupTypes: true } } },
  })

  if (rate && rate._count.groupTypes > 0) {
    throw new Error('Невозможно удалить ставку, которая привязана к типу группы')
  }

  await prisma.rate.delete(payload)
  revalidatePath('/dashboard')
}
