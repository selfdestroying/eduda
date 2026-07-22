'use server'

import prisma from '@/src/lib/db/prisma'
import { ConflictError } from '@/src/lib/error'
import { authAction } from '@/src/lib/safe-action'
import { CreateGroupTypeSchema, DeleteGroupTypeSchema, UpdateGroupTypeSchema } from './schemas'

export const getGroupTypes = authAction
  .metadata({ actionName: 'getGroupTypes' })
  .action(async ({ ctx }) => {
    return await prisma.groupType.findMany({
      where: { organizationId: ctx.session.organizationId! },
      include: {
        rate: true,
        _count: { select: { groups: true } },
      },
      orderBy: { name: 'asc' },
    })
  })

export const getRates = authAction.metadata({ actionName: 'getRates' }).action(async ({ ctx }) => {
  return await prisma.rate.findMany({
    where: { organizationId: ctx.session.organizationId! },
    orderBy: { name: 'asc' },
  })
})

export const createGroupType = authAction
  .metadata({ actionName: 'createGroupType' })
  .inputSchema(CreateGroupTypeSchema)
  .action(async ({ parsedInput, ctx }) => {
    await prisma.groupType.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updateGroupType = authAction
  .metadata({ actionName: 'updateGroupType' })
  .inputSchema(UpdateGroupTypeSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.groupType.update({
      where: { id },
      data,
    })
  })

export const deleteGroupType = authAction
  .metadata({ actionName: 'deleteGroupType' })
  .inputSchema(DeleteGroupTypeSchema)
  .action(async ({ parsedInput }) => {
    const groupType = await prisma.groupType.findUnique({
      where: { id: parsedInput.id },
      include: { _count: { select: { groups: true } } },
    })

    if (groupType && groupType._count.groups > 0) {
      throw new ConflictError('Невозможно удалить тип группы, который используется в группах')
    }

    await prisma.groupType.delete({ where: { id: parsedInput.id } })
  })
