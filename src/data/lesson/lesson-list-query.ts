import { getLessons } from '@/src/actions/lessons'
import { normalizeDateOnly } from '@/src/lib/timezone'
import { getGroupName } from '@/src/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { endOfMonth, startOfMonth } from 'date-fns'
import { lessonKeys } from './keys'

async function getLessonList(organizationId: number, date?: Date) {
  if (!date) {
    throw new Error('Укажите дату')
  }
  const normalizedDate = normalizeDateOnly(date)
  const data = await getLessons({
    where: {
      date: normalizedDate,
      organizationId,
    },
    include: {
      attendance: true,
      group: { include: { course: true, location: true } },
      teachers: { include: { teacher: true } },
    },
    orderBy: { time: 'asc' },
  })

  return data
}

async function getDayStatuses(organizationId: number, date: Date) {
  const from = startOfMonth(date)
  const to = endOfMonth(date)
  const normalizedFrom = normalizeDateOnly(from)
  const normalizedTo = normalizeDateOnly(to)

  const data = await getLessons({
    where: {
      date: {
        gte: normalizedFrom,
        lte: normalizedTo,
      },
      organizationId,
    },
    include: {
      attendance: true,
      group: { include: { course: true, location: true } },
      teachers: { include: { teacher: true } },
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  })

  return data
}

export type LessonListData = Awaited<ReturnType<typeof getLessonList>>

export const useLessonListQuery = (organizationId: number, date: Date) => {
  const dateKey = normalizeDateOnly(date).toISOString().split('T')[0]
  return useQuery({
    queryKey: lessonKeys.byDate(organizationId, dateKey),
    queryFn: () => getLessonList(organizationId, date),
    enabled: !!organizationId && !!date,
  })
}

export const useMappedLessonListQuery = (organizationId: number, date?: Date) => {
  const dateKey = date ? normalizeDateOnly(date).toISOString().split('T')[0] : ''
  return useQuery({
    queryKey: lessonKeys.byDate(organizationId, dateKey),
    queryFn: () => getLessonList(organizationId, date),
    enabled: !!organizationId && !!date,
    select: (lessons) =>
      lessons.map((lesson) => {
        const groupName = getGroupName(lesson.group)
        const location = lesson.group.location?.name
        const teachers = lesson.teachers.map((t) => t.teacher.name).join(', ')
        const parts = [groupName, location, teachers]
        return { label: parts.join(' · '), value: lesson.id }
      }),
  })
}

export const useDayStatusesQuery = (organizationId: number, date: Date) => {
  const dateKey = normalizeDateOnly(date).toISOString().split('T')[0]
  return useQuery({
    queryKey: lessonKeys.byMonth(organizationId, dateKey),
    queryFn: () => getDayStatuses(organizationId, date),
    enabled: !!organizationId && !!date,
    select: (lessons) => {
      const statuses: Record<string, boolean[]> = {}
      lessons.forEach((lesson) => {
        const day = new Date(lesson.date).toISOString().split('T')[0]
        if (!statuses[day]) {
          statuses[day] = []
        }
        statuses[day].push(lesson.attendance.some((a) => a.status === 'UNSPECIFIED'))
      })
      return statuses
    },
  })
}
