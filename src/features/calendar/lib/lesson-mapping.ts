import type { CalendarCategory, CalendarEvent, CalendarLessonDTO } from '../types'
import { colorForCourse } from './constants'

/** `"14:30"` → минуты от полуночи. */
function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** DTO уроков → события календаря (минуты, цвет по курсу). */
export function mapLessonsToEvents(lessons: CalendarLessonDTO[]): CalendarEvent[] {
  return lessons.map((l) => {
    const start = parseTime(l.time)
    return {
      id: `l${l.id}`,
      lessonId: l.id,
      date: l.date,
      title: l.title,
      location: l.location,
      start,
      end: Math.min(1440, start + l.duration),
      courseId: l.courseId,
      color: colorForCourse(l.courseId),
      cancelled: l.cancelled,
    }
  })
}

/** Уникальные курсы из загруженных событий — «календари» для боковой панели. */
export function deriveCategories(events: CalendarEvent[]): CalendarCategory[] {
  const map = new Map<number, CalendarCategory>()
  for (const e of events) {
    const existing = map.get(e.courseId)
    if (existing) existing.count++
    else map.set(e.courseId, { id: e.courseId, name: e.title, color: e.color, count: 1 })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
