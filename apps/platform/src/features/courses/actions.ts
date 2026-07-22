'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { CreateCourseSchema, DeleteCourseSchema, UpdateCourseSchema } from './schemas'

export const getCourses = authAction
  .metadata({ actionName: 'getCourses' })
  .action(async ({ ctx }) => {
    return await prisma.course.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
      },
      orderBy: { id: 'asc' },
    })
  })

export const createCourse = authAction
  .metadata({ actionName: 'createCourse' })
  .inputSchema(CreateCourseSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.course.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updateCourse = authAction
  .metadata({ actionName: 'updateCourse' })
  .inputSchema(UpdateCourseSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.course.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

export const deleteCourse = authAction
  .metadata({ actionName: 'deleteCourse' })
  .inputSchema(DeleteCourseSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.course.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
