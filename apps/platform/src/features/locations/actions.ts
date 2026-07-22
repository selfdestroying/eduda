'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { CreateLocationSchema, DeleteLocationSchema, UpdateLocationSchema } from './schemas'

export const getLocations = authAction
  .metadata({ actionName: 'getLocations' })
  .action(async ({ ctx }) => {
    return await prisma.location.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
      },
      orderBy: { id: 'asc' },
    })
  })

export const createLocation = authAction
  .metadata({ actionName: 'createLocation' })
  .inputSchema(CreateLocationSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.location.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updateLocation = authAction
  .metadata({ actionName: 'updateLocation' })
  .inputSchema(UpdateLocationSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.location.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

export const deleteLocation = authAction
  .metadata({ actionName: 'deleteLocation' })
  .inputSchema(DeleteLocationSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.location.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
