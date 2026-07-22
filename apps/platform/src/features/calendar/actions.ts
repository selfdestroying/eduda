'use server'

import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { headers } from 'next/headers'
import { z } from 'zod'
import type { CalendarLessonDTO } from './types'

const rangeSchema = z.object({
  /** Начало диапазона, `YYYY-MM-DD` включительно. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Конец диапазона, `YYYY-MM-DD` включительно. */
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * Уроки организации за диапазон дат — облегчённый DTO для календаря.
 * Учитель (без права `lesson.readAll`) видит только свои уроки.
 */
export const getCalendarLessons = authAction
  .metadata({ actionName: 'getCalendarLessons' })
  .inputSchema(rangeSchema)
  .action(async ({ ctx, parsedInput }): Promise<CalendarLessonDTO[]> => {
    const { from, to } = parsedInput

    // organizationId передаём явно: без него better-auth возьмёт
    // `session.activeOrganizationId`, который может указывать на другую школу,
    // чем поддомен запроса.
    const canReadAll = await auth.api.hasPermission({
      headers: await headers(),
      body: {
        organizationId: String(ctx.session.organizationId),
        permissions: { lesson: ['readAll'] },
      },
    })
    const teacherFilter = !canReadAll.success
      ? { some: { teacherId: Number(ctx.session.user.id) } }
      : undefined

    const lessons = await prisma.lesson.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
        date: { gte: from, lte: to },
        teachers: teacherFilter,
      },
      include: {
        group: {
          include: {
            course: true,
            location: true,
            groupType: true,
            teachers: { include: { teacher: { select: { id: true, name: true } } } },
          },
        },
        attendance: { select: { status: true } },
      },
      orderBy: { time: 'asc' },
    })

    return lessons.map((l) => ({
      id: l.id,
      date: l.date,
      time: l.time,
      duration: l.duration,
      title: l.group.course.name,
      location: l.group.location.name,
      courseId: l.group.courseId,
      groupId: l.groupId,
      locationId: l.group.locationId,
      groupTypeId: l.group.groupTypeId,
      groupType: l.group.groupType?.name ?? null,
      teachers: l.group.teachers.map((t) => ({ id: t.teacher.id, name: t.teacher.name })),
      cancelled: l.status === 'CANCELLED',
      allMarked: l.attendance.every((a) => a.status !== 'UNSPECIFIED'),
    }))
  })
