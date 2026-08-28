import type { EnrollmentGroupBy } from './schemas'
import type { EnrollmentGroupRow, EnrollmentTeacher } from './types'

/**
 * Измерения одной записи «ученик — группа» — всё, по чему её можно свернуть.
 * Имена уже разрешены: `getGroupName` собирает подпись группы из курса и
 * расписания, когда своего имени у группы нет, и делать это внутри свёртки
 * значило бы тащить сюда зависимости и мешать проверке гонять её на голых данных.
 */
export type EnrollmentDimensions = {
  studentId: number
  groupId: number
  groupName: string
  courseId: number
  courseName: string
  locationId: number | null
  locationName: string | null
  /**
   * Ключ набора преподавателей группы — id по возрастанию через запятую, `none`
   * у группы без преподавателя.
   *
   * Именно **набором**, а не поодиночке, как и в выручке
   * (`finances/revenue/group.ts`): у части групп их двое, и положить запись в
   * корзину каждого значило бы посчитать её дважды. Сумма строк обязана сходиться
   * с числом записей, поэтому пара ведёт свою строку («Иванов, Петров»), а группа
   * без преподавателя — свою.
   */
  teacherKey: string
  /** Те же преподаватели с id: из них строка сводки собирает ссылки. */
  teachers: EnrollmentTeacher[]
}

/** Во что превращается запись в выбранной свёртке. */
type Dimension = Pick<EnrollmentGroupRow, 'key' | 'label' | 'groupId' | 'teachers'>

const EMPTY: Pick<Dimension, 'groupId' | 'teachers'> = { groupId: null, teachers: null }

function dimensionOf(by: EnrollmentGroupBy, row: EnrollmentDimensions): Dimension {
  switch (by) {
    case 'group':
      return { ...EMPTY, key: `g${row.groupId}`, label: row.groupName, groupId: row.groupId }
    case 'course':
      return { ...EMPTY, key: `c${row.courseId}`, label: row.courseName }
    case 'teacher':
      return {
        ...EMPTY,
        key: `t${row.teacherKey}`,
        // Подпись собирается здесь, а не приходит готовой: иначе имена жили бы
        // в двух местах — строкой и списком — и могли бы разойтись.
        label:
          row.teachers.length === 0
            ? 'Без преподавателя'
            : row.teachers.map((teacher) => teacher.name).join(', '),
        teachers: row.teachers,
      }
    case 'location':
      return {
        ...EMPTY,
        key: `loc${row.locationId ?? 'none'}`,
        label: row.locationName ?? 'Без локации',
      }
  }
}

/**
 * Свёртка записей по выбранному измерению.
 *
 * Отдельно от экшена и без зависимостей, кроме типов, — как `foldRevenueGroups`:
 * так её гоняет `scripts/check-enrollment-groups.ts` на настоящих данных, не
 * поднимая сессию.
 *
 * Каждая запись попадает ровно в одну корзину при любом измерении. На этом стоит
 * равенство «сумма `count` по строкам = число записей», которое сторожит проверка.
 */
export function foldEnrollmentGroups(
  by: EnrollmentGroupBy,
  rows: EnrollmentDimensions[],
): EnrollmentGroupRow[] {
  const buckets = new Map<string, { row: Dimension & { count: number }; students: Set<number> }>()

  for (const row of rows) {
    const dimension = dimensionOf(by, row)
    const bucket = buckets.get(dimension.key)
    if (bucket) {
      bucket.row.count++
      bucket.students.add(row.studentId)
      continue
    }
    buckets.set(dimension.key, {
      row: { ...dimension, count: 1 },
      students: new Set([row.studentId]),
    })
  }

  return [...buckets.values()].map(({ row, students }) => ({ ...row, students: students.size }))
}

/** Порядок строк сводки. Ключ — id колонки, как и у плоского списка. */
export const ENROLLMENT_GROUP_SORTERS: Record<
  string,
  (a: EnrollmentGroupRow, b: EnrollmentGroupRow) => number
> = {
  label: (a, b) => a.label.localeCompare(b.label, 'ru'),
  count: (a, b) => a.count - b.count,
  students: (a, b) => a.students - b.students,
}

/**
 * Порядок по умолчанию — крупные сверху: сводку открывают, чтобы увидеть, где
 * людей больше. При равенстве — по подписи, иначе строки с одинаковым числом
 * переставляются между запросами.
 */
export function sortEnrollmentGroups(
  rows: EnrollmentGroupRow[],
  sort: { id: string; desc: boolean } | null | undefined,
): EnrollmentGroupRow[] {
  const sorter = sort ? ENROLLMENT_GROUP_SORTERS[sort.id] : undefined
  if (sorter) {
    return [...rows].sort(
      (a, b) => (sort!.desc ? -sorter(a, b) : sorter(a, b)) || a.label.localeCompare(b.label, 'ru'),
    )
  }
  return [...rows].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'))
}
