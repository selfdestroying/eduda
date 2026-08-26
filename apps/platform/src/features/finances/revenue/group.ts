import type { RevenueGroupBy } from './schemas'
import type { RevenueGroupRow, RevenueGroupsResult } from './types'

/** Итоги базы по одному уроку: столько денег и столько занятий на нём. */
export type LessonTotals = {
  lessonId: number
  revenue: number
  /** Занятий с ценой. */
  paid: number
  /** Занятий всего, вместе с ждущими оплаты. */
  total: number
}

/**
 * Измерения урока — всё, по чему сводится выручка. У отметки этого нет: она знает
 * только свой урок, а день, группа, курс, преподаватель и локация лежат на нём.
 */
export type LessonDimensions = {
  id: number
  date: string
  groupId: number
  groupName: string
  courseId: number
  courseName: string
  locationId: number | null
  locationName: string | null
  /**
   * Преподаватели урока — **набором**, а не поодиночке: у 2% уроков их двое, и
   * положить такой урок в корзину каждого значило бы посчитать его деньги дважды.
   * Сумма строк обязана сходиться с итогом, поэтому пара ведёт свою строку
   * («Иванов, Петров»), а урок без преподавателя — свою.
   */
  teacherKey: string
  teacherLabel: string
}

/** Во что превращается урок в выбранной свёртке. */
type Dimension = Pick<RevenueGroupRow, 'key' | 'date' | 'lessonId' | 'groupId' | 'label'>

const EMPTY: Dimension = { key: '', date: null, lessonId: null, groupId: null, label: null }

function dimensionOf(by: RevenueGroupBy, lesson: LessonDimensions): Dimension {
  switch (by) {
    case 'date':
      return { ...EMPTY, key: lesson.date, date: lesson.date }
    case 'group':
      return {
        ...EMPTY,
        key: `g${lesson.groupId}`,
        groupId: lesson.groupId,
        label: lesson.groupName,
      }
    case 'lesson':
      return {
        key: `l${lesson.id}`,
        date: lesson.date,
        lessonId: lesson.id,
        groupId: lesson.groupId,
        label: lesson.groupName,
      }
    case 'course':
      return { ...EMPTY, key: `c${lesson.courseId}`, label: lesson.courseName }
    case 'teacher':
      return { ...EMPTY, key: `t${lesson.teacherKey}`, label: lesson.teacherLabel }
    case 'location':
      return {
        ...EMPTY,
        key: `loc${lesson.locationId ?? 'none'}`,
        label: lesson.locationName ?? 'Без локации',
      }
  }
}

/**
 * Свёртка выручки по выбранному измерению.
 *
 * Отдельно от экшена и без зависимостей, кроме типов: так её гоняет
 * `scripts/check-revenue.ts` на настоящих данных, не поднимая сессию.
 *
 * Каждый урок попадает ровно в одну корзину — при любом измерении. На этом стоит
 * равенство «сумма строк = итог», которое сторожит проверка.
 *
 * Итоги (`revenue`, `paidCount`, `attendanceCount`) считаются по всей выборке, а
 * не по странице: карточки над таблицей отвечают на вопрос «сколько за период», и
 * страница на них влиять не должна.
 */
export function foldRevenueGroups(
  by: RevenueGroupBy,
  perLesson: LessonTotals[],
  lessons: LessonDimensions[],
): Omit<RevenueGroupsResult, 'rows' | 'total'> & { rows: RevenueGroupRow[] } {
  const lessonById = new Map(lessons.map((l) => [l.id, l]))
  const buckets = new Map<string, RevenueGroupRow>()

  let revenue = 0
  let paidCount = 0
  let attendanceCount = 0

  for (const row of perLesson) {
    // Урок отобрался по отметке, но сам под условие не подошёл — так бывает,
    // когда поиск сузил отметки сильнее, чем уроки. Измерений для строки нет.
    const lesson = lessonById.get(row.lessonId)
    if (!lesson) continue

    revenue += row.revenue
    paidCount += row.paid
    attendanceCount += row.total

    const dimension = dimensionOf(by, lesson)
    const bucket = buckets.get(dimension.key)
    if (bucket) {
      bucket.revenue += row.revenue
      bucket.paid += row.paid
      bucket.total += row.total
      continue
    }

    buckets.set(dimension.key, {
      ...dimension,
      revenue: row.revenue,
      paid: row.paid,
      total: row.total,
    })
  }

  return { rows: [...buckets.values()], revenue, paidCount, attendanceCount }
}

/** Порядок строк сводки. Ключ — id колонки, как и у плоского списка. */
export const GROUP_SORTERS: Record<string, (a: RevenueGroupRow, b: RevenueGroupRow) => number> = {
  // Дни — date-only строки: лексикографический порядок совпадает с хронологическим.
  date: (a, b) => (a.date ?? '').localeCompare(b.date ?? ''),
  label: (a, b) => (a.label ?? '').localeCompare(b.label ?? '', 'ru'),
  revenue: (a, b) => a.revenue - b.revenue,
  count: (a, b) => a.paid - b.paid,
}

/**
 * Порядок по умолчанию. Там, где есть дата, он хронологический, от свежих: так же
 * отсортирован плоский список. У остальных измерений даты нет вовсе, и сравнивать
 * их осмысленно можно только деньгами.
 */
export function sortRevenueGroups(
  rows: RevenueGroupRow[],
  by: RevenueGroupBy,
  sort: { id: string; desc: boolean } | null | undefined,
): RevenueGroupRow[] {
  const sorter = sort ? GROUP_SORTERS[sort.id] : undefined
  if (sorter) return [...rows].sort((a, b) => (sort!.desc ? -sorter(a, b) : sorter(a, b)))

  const byDate = by === 'date' || by === 'lesson'
  return [...rows].sort(
    byDate ? (a, b) => -GROUP_SORTERS.date!(a, b) : (a, b) => b.revenue - a.revenue,
  )
}
