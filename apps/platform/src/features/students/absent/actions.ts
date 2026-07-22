'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'

// ─── READ ────────────────────────────────────────────────────────────────────

export const getAbsentAttendances = authAction
  .metadata({ actionName: 'getAbsentAttendances' })
  .action(async ({ ctx }) => {
    return await prisma.attendance.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
        status: 'ABSENT',
        OR: [
          {
            AND: [{ makeupAttendance: { is: null } }, { makeupForAttendanceId: null }],
          },
          { makeupForAttendanceId: { not: null } },
        ],
      },
      include: {
        student: true,
        lesson: {
          include: {
            group: {
              include: {
                course: true,
                location: true,
                schedules: true,
                teachers: {
                  include: {
                    teacher: true,
                  },
                },
              },
            },
          },
        },
        makeupForAttendance: { include: { lesson: true } },
        makeupAttendance: { include: { lesson: true } },
      },
      orderBy: [{ lesson: { date: 'desc' } }],
    })
  })
