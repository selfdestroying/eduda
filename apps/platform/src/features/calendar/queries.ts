import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getCalendarLessons } from './actions'
import type { CalendarLessonDTO } from './types'

export const calendarKeys = {
  all: ['calendar'] as const,
  range: (from: string, to: string) => ['calendar', 'lessons', from, to] as const,
}

/** Уроки за диапазон дат для отображения в календаре. */
export function useCalendarLessonsQuery(from: string, to: string) {
  return useQuery<CalendarLessonDTO[]>({
    queryKey: calendarKeys.range(from, to),
    queryFn: async () => {
      const { data, serverError } = await getCalendarLessons({ from, to })
      if (serverError) throw serverError
      return data ?? []
    },
    enabled: Boolean(from && to),
    placeholderData: keepPreviousData,
  })
}
