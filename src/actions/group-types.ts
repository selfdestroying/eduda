'use server'

import prisma from '@/src/lib/db/prisma'
import { revalidatePath } from 'next/cache'
import { Prisma } from '../../prisma/generated/client'

export const getGroupTypes = async <T extends Prisma.GroupTypeFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.GroupTypeFindManyArgs>,
) => {
  return await prisma.groupType.findMany<T>(payload)
}

export const getGroupType = async <T extends Prisma.GroupTypeFindFirstArgs>(
  payload: Prisma.SelectSubset<T, Prisma.GroupTypeFindFirstArgs>,
) => {
  return await prisma.groupType.findFirst(payload)
}

export const createGroupType = async (payload: Prisma.GroupTypeCreateArgs) => {
  await prisma.groupType.create(payload)
  revalidatePath('/dashboard')
}

export const updateGroupType = async (payload: Prisma.GroupTypeUpdateArgs) => {
  await prisma.groupType.update(payload)
  revalidatePath('/dashboard')
}

export const deleteGroupType = async (payload: Prisma.GroupTypeDeleteArgs) => {
  const groupType = await prisma.groupType.findUnique({
    where: payload.where,
    include: { _count: { select: { groups: true } } },
  })

  if (groupType && groupType._count.groups > 0) {
    throw new Error('Невозможно удалить тип группы, который используется в группах')
  }

  await prisma.groupType.delete(payload)
  revalidatePath('/dashboard')
}
