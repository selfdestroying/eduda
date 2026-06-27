'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { z } from 'zod'
import type { CalendarLessonDTO } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** @db.Date (UTC-полночь) → строка `YYYY-MM-DD` по компонентам UTC. */
const dbDateToYmd = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

const rangeSchema = z.object({
  /** Начало диапазона, `YYYY-MM-DD` включительно. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Конец диапазона, `YYYY-MM-DD` включительно. */
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * Уроки организации за диапазон дат — облегчённый DTO для календаря.
 */
export const getCalendarLessons = authAction
  .metadata({ actionName: 'getCalendarLessons' })
  .inputSchema(rangeSchema)
  .action(async ({ ctx, parsedInput }): Promise<CalendarLessonDTO[]> => {
    const from = new Date(parsedInput.from)
    const to = new Date(parsedInput.to)

    const lessons = await prisma.lesson.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
        date: { gte: from, lte: to },
      },
      include: {
        group: { include: { course: true, location: true } },
      },
      orderBy: { time: 'asc' },
    })

    return lessons.map((l) => ({
      id: l.id,
      date: dbDateToYmd(l.date),
      time: l.time,
      duration: l.duration,
      title: l.group.course.name,
      location: l.group.location.name,
      courseId: l.group.courseId,
      cancelled: l.status === 'CANCELLED',
    }))
  })
