'use server'

import prisma from '@/src/lib/db/prisma'
import { ConflictError } from '@/src/lib/error'
import { requirePermission } from '@/src/lib/permissions/require-permission'
import { authAction } from '@/src/lib/safe-action'
import { GroupTypeSchema } from '@/src/schemas/group-type'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '../../prisma/generated/client'

// ─── Read (остаются обычными server-функциями для data-fetching) ───

export const getGroupTypes = async <T extends Prisma.GroupTypeFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.GroupTypeFindManyArgs>,
) => {
  await requirePermission('groupType', 'read')
  return await prisma.groupType.findMany<T>(payload)
}

export const getGroupType = async <T extends Prisma.GroupTypeFindFirstArgs>(
  payload: Prisma.SelectSubset<T, Prisma.GroupTypeFindFirstArgs>,
) => {
  await requirePermission('groupType', 'read')
  return await prisma.groupType.findFirst(payload)
}

// ─── Mutations (safe actions с валидацией и проверкой прав) ─────────

export const createGroupTypeAction = authAction
  .metadata({ actionName: 'createGroupType' })
  .schema(GroupTypeSchema)
  .action(async ({ parsedInput, ctx }) => {
    await requirePermission('groupType', 'create')

    await prisma.groupType.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })

    revalidatePath('/dashboard')
  })

export const updateGroupTypeAction = authAction
  .metadata({ actionName: 'updateGroupType' })
  .schema(GroupTypeSchema.extend({ id: z.number().int().positive() }))
  .action(async ({ parsedInput }) => {
    await requirePermission('groupType', 'update')

    const { id, ...data } = parsedInput

    await prisma.groupType.update({
      where: { id },
      data,
    })

    revalidatePath('/dashboard')
  })

export const deleteGroupTypeAction = authAction
  .metadata({ actionName: 'deleteGroupType' })
  .schema(z.object({ id: z.number().int().positive() }))
  .action(async ({ parsedInput }) => {
    await requirePermission('groupType', 'delete')

    const groupType = await prisma.groupType.findUnique({
      where: { id: parsedInput.id },
      include: { _count: { select: { groups: true } } },
    })

    if (groupType && groupType._count.groups > 0) {
      throw new ConflictError('Невозможно удалить тип группы, который используется в группах')
    }

    await prisma.groupType.delete({ where: { id: parsedInput.id } })

    revalidatePath('/dashboard')
  })
