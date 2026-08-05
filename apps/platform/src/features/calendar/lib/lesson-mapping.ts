import type { CalendarCategory, CalendarEvent, CalendarLessonDTO, FilterDimension } from '../types'
import { colorForGroupType, colorForId } from './constants'

/** `"14:30"` → минуты от полуночи. */
function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** DTO уроков → события календаря (минуты, цвет по типу группы). */
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
      groupId: l.groupId,
      color: colorForGroupType(l.groupTypeId ?? 0),
      locationId: l.locationId,
      groupTypeId: l.groupTypeId ?? 0,
      groupType: l.groupType ?? 'Без типа',
      teachers: l.teachers,
      cancelled: l.cancelled,
      allMarked: l.allMarked,
    }
  })
}

/** Извлекает категории `(id, name, color)`, к которым относится событие в данном измерении. */
function categoryKeys(e: CalendarEvent, dim: FilterDimension): CalendarCategory[] {
  if (dim === 'groupType')
    return [{ id: e.groupTypeId, name: e.groupType, color: e.color, count: 0 }]
  if (dim === 'course')
    return [{ id: e.courseId, name: e.title, color: colorForId(e.courseId), count: 0 }]
  if (dim === 'location')
    return [{ id: e.locationId, name: e.location, color: colorForId(e.locationId), count: 0 }]
  return e.teachers.map((t) => ({ id: t.id, name: t.name, color: colorForId(t.id), count: 0 }))
}

/**
 * Уникальные категории из загруженных событий для указанного измерения — «календари»
 * боковой панели. `count` — число уроков, относящихся к категории.
 */
export function deriveCategories(
  events: CalendarEvent[],
  dim: FilterDimension,
): CalendarCategory[] {
  const map = new Map<number, CalendarCategory>()
  for (const e of events) {
    for (const key of categoryKeys(e, dim)) {
      const existing = map.get(key.id)
      if (existing) existing.count++
      else map.set(key.id, { ...key, count: 1 })
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
