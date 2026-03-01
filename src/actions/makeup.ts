'use server'
import prisma from '@/src/lib/db/prisma'
import { revalidatePath } from 'next/cache'
import { Prisma } from '../../prisma/generated/client'

export const createMakeUp = async (data: Prisma.MakeUpUncheckedCreateInput) => {
  const makeUp = await prisma.makeUp.create({
    data,
    include: { missedAttendance: true },
  })
  revalidatePath(`/dashboard/lessons/${makeUp.missedAttendance.lessonId}`)
}
