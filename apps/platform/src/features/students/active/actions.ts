'use server'

import { prisma } from '@repo/db'
import { authAction } from '@/src/lib/safe-action'

// ─── READ ────────────────────────────────────────────────────────────────────

export const getActiveStudents = authAction
  .metadata({ actionName: 'getActiveStudents' })
  .action(async ({ ctx }) => {
    return await prisma.studentGroup.findMany({
      where: { organizationId: ctx.session.organizationId!, status: { in: ['ACTIVE', 'TRIAL'] } },
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
            packages: true,
          },
        },
        wallet: true,
      },
    })
  })
