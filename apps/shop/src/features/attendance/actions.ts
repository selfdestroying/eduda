'use server'

import { studentAction } from '@/src/lib/safe-action'
import { getGroupName } from '@/src/lib/utils'
import { prisma } from '@repo/db'
import * as z from 'zod'

/**
 * Посещаемость ученика. Выборка ЯВНАЯ и узкая: `comment`, `isWarned`,
 * `walletId`, отработки — внутренняя кухня учителя, и на сервере она и остаётся
 * (§11.11). Отменённые уроки в кабинете не показываем.
 */
export const getAttendance = studentAction
  .metadata({ actionName: 'getAttendance' })
  .inputSchema(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
  .action(async ({ ctx, parsedInput }) => {
    const rows = await prisma.attendance.findMany({
      where: {
        organizationId: ctx.student.organizationId,
        studentId: ctx.student.id,
        lesson: { status: 'ACTIVE' },
      },
      select: {
        status: true,
        lesson: {
          select: {
            id: true,
            date: true,
            time: true,
            group: {
              select: {
                name: true,
                course: { select: { name: true } },
                schedules: { select: { dayOfWeek: true, time: true } },
              },
            },
          },
        },
      },
      // `Lesson.date` — date-only строка `YYYY-MM-DD`, сортируется лексикографически
      // = хронологически, поэтому сортируем прямо по ней.
      orderBy: [{ lesson: { date: 'desc' } }, { lesson: { time: 'desc' } }],
      take: parsedInput.limit,
    })

    return rows.map((row) => ({
      lessonId: row.lesson.id,
      date: row.lesson.date,
      time: row.lesson.time,
      group: getGroupName(row.lesson.group),
      course: row.lesson.group.course.name,
      status: row.status,
    }))
  })
