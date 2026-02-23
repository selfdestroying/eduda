'use server'
import prisma from '@/src/lib/prisma'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { Prisma } from '../../prisma/generated/client'
import { auth } from '../lib/auth'

export interface UserCreateParams {
  email: string
  password: string
  name: string
  role: 'user' | 'admin' | 'owner' | ('user' | 'admin' | 'owner')[]
  data: {
    firstName: string
    lastName: string
    bidForLesson: number
    bidForIndividual: number
    bonusPerStudent: number
  }
}

export const getUsers = async <T extends Prisma.UserFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>
) => {
  return await prisma.user.findMany<T>(payload)
}

export const getUser = async <T extends Prisma.UserFindFirstArgs>(
  payload: Prisma.SelectSubset<T, Prisma.UserFindFirstArgs>
) => {
  return await prisma.user.findFirst(payload)
}

export const createUser = async (params: UserCreateParams) => {
  return await auth.api.createUser({ body: params, headers: await headers() })
}

export const updateUser = async (payload: Prisma.UserUpdateArgs, isApplyToLessons: boolean) => {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update(payload)
    if (isApplyToLessons) {
      await tx.teacherLesson.updateMany({
        where: {
          teacherId: user.id,
          lesson: {
            date: { gt: new Date() },
            group: { type: { in: ['GROUP', 'SPLIT'] } },
          },
        },
        data: {
          bid: user.bidForLesson,
          bonusPerStudent: user.bonusPerStudent,
        },
      })
      await tx.teacherLesson.updateMany({
        where: {
          teacherId: user.id,
          lesson: {
            date: { gt: new Date() },
            group: { type: 'INDIVIDUAL' },
          },
        },
        data: {
          bid: user.bidForIndividual,
          bonusPerStudent: user.bonusPerStudent,
        },
      })
      await tx.teacherGroup.updateMany({
        where: {
          teacherId: user.id,
          group: { type: { in: ['GROUP', 'SPLIT'] } },
        },
        data: {
          bid: user.bidForLesson,
          bonusPerStudent: user.bonusPerStudent,
        },
      })
      await tx.teacherGroup.updateMany({
        where: {
          teacherId: user.id,
          group: { type: 'INDIVIDUAL' },
        },
        data: {
          bid: user.bidForIndividual,
          bonusPerStudent: user.bonusPerStudent,
        },
      })
    }
  })

  revalidatePath(`dashboard/users/${payload.where.id}`)
}
