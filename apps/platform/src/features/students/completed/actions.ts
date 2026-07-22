'use server'
import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'

export const getCompletedStudents = authAction
  .metadata({ actionName: 'getCompletedStudents' })
  .action(async ({ ctx }) => {
    return await prisma.studentGroup.findMany({
      where: { organizationId: ctx.session.organizationId!, status: 'COMPLETED' },
      include: {
        group: {
          include: {
            location: true,
            course: true,
            schedules: true,
            teachers: {
              include: {
                teacher: true,
              },
            },
          },
        },
        student: {
          include: {
            payments: true,
          },
        },
        wallet: true,
      },
    })
  })
