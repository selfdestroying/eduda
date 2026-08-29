import type { AbsentGroupBy } from './schemas'
import type { AbsentGroupRow, AbsentTeacher } from './types'

/**
 * Измерения одного пропуска — всё, по чему его можно свернуть. Имена уже
 * разрешены: `getGroupName` собирает подпись группы из курса и расписания, когда
 * своего имени у группы нет, и делать это внутри свёртки значило бы тащить сюда
 * зависимости и мешать проверке гонять её на голых данных.
 */
export type AbsentDimensions = {
  studentId: number
  studentName: string
  groupId: number
  groupName: string
  courseId: number
  courseName: string
  locationId: number | null
  locationName: string | null
  /**
   * Преподаватели **урока** — набором, а не поодиночке (как в выручке и в
   * записях): у «Алгоритмики» 183 пропуска пришлись на уроки с двумя, и положить
   * такой пропуск в корзину каждого значило бы посчитать его дважды — и штуками,
   * и деньгами. Сумма строк обязана сходиться с числом пропусков, поэтому пара
   * ведёт свою строку, а урок без преподавателя — свою.
   *
   * Именно с урока, а не с группы: строка — это конкретное занятие, и вести его
   * мог не тот, кто закреплён за группой сегодня.
   */
  teacherKey: string
  teachers: AbsentTeacher[]
  /** Предупреждением считается ровно `true`: `false` и не проставленный флаг равны. */
  isWarned: boolean
  /**
   * Цена, застывшая в момент списания, или `null`, если списания не было.
   * Предупреждённый пропуск не списывается и родителю не стоит ничего; сама
   * пропущенная отработка списывается и стоит.
   */
  price: number | null
  /** Отработка состоялась — ученик на неё пришёл. Назначенная, но не проведённая не в счёт. */
  makeupAttended: boolean
  /** Цена той отработки: списание предупреждённого пропуска произошло на ней. */
  makeupPrice: number | null
}

/** Во что превращается пропуск в выбранной свёртке. */
type Dimension = Pick<AbsentGroupRow, 'key' | 'label' | 'studentId' | 'groupId' | 'teachers'>

const EMPTY: Pick<Dimension, 'studentId' | 'groupId' | 'teachers'> = {
  studentId: null,
  groupId: null,
  teachers: null,
}

function dimensionOf(by: AbsentGroupBy, row: AbsentDimensions): Dimension {
  switch (by) {
    case 'student':
      return {
        ...EMPTY,
        key: `s${row.studentId}`,
        label: row.studentName,
        studentId: row.studentId,
      }
    case 'group':
      return { ...EMPTY, key: `g${row.groupId}`, label: row.groupName, groupId: row.groupId }
    case 'course':
      return { ...EMPTY, key: `c${row.courseId}`, label: row.courseName }
    case 'teacher':
      return {
        ...EMPTY,
        key: `t${row.teacherKey}`,
        // Подпись собирается здесь, а не приходит готовой: иначе имена жили бы в
        // двух местах — строкой и списком — и могли бы разойтись.
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
 * Свёртка пропусков по выбранному измерению.
 *
 * Отдельно от экшена и без зависимостей, кроме типов, — как `foldRevenueGroups` и
 * `foldEnrollmentGroups`: так её гоняет `scripts/check-absent-groups.ts` на
 * настоящих данных, не поднимая сессию.
 *
 * Каждый пропуск попадает ровно в одну корзину при любом измерении. На этом стоят
 * оба равенства, которые сторожит проверка: «сумма count = число пропусков» и
 * «сумма lost = потерянные деньги по всей выборке».
 */
export function foldAbsentGroups(by: AbsentGroupBy, rows: AbsentDimensions[]): AbsentGroupRow[] {
  const buckets = new Map<
    string,
    {
      row: Dimension & Pick<AbsentGroupRow, 'count' | 'unwarned' | 'lost' | 'saved'>
      students: Set<number>
    }
  >()

  for (const row of rows) {
    // Деньги теряются там, где занятие списалось, а списалось оно ровно там, где
    // на строке стоит цена: у пропуска без предупреждения и у пропущенной
    // отработки. У предупреждённого пропуска цены нет — терять нечего.
    const lost = row.price ?? 0
    // И обратное: предупредил и отходил — занятие списалось на отработке, а не
    // пропало. Пропуск не может одновременно терять и спасать.
    const saved = row.isWarned && row.makeupAttended ? (row.makeupPrice ?? 0) : 0

    const dimension = dimensionOf(by, row)
    const bucket = buckets.get(dimension.key)
    if (bucket) {
      bucket.row.count++
      if (!row.isWarned) bucket.row.unwarned++
      bucket.row.lost += lost
      bucket.row.saved += saved
      bucket.students.add(row.studentId)
      continue
    }
    buckets.set(dimension.key, {
      row: { ...dimension, count: 1, unwarned: row.isWarned ? 0 : 1, lost, saved },
      students: new Set([row.studentId]),
    })
  }

  return [...buckets.values()].map(({ row, students }) => ({ ...row, students: students.size }))
}

/** Порядок строк сводки. Ключ — id колонки, как и у плоского списка. */
export const ABSENT_GROUP_SORTERS: Record<
  string,
  (a: AbsentGroupRow, b: AbsentGroupRow) => number
> = {
  label: (a, b) => a.label.localeCompare(b.label, 'ru'),
  count: (a, b) => a.count - b.count,
  unwarned: (a, b) => a.unwarned - b.unwarned,
  students: (a, b) => a.students - b.students,
  lost: (a, b) => a.lost - b.lost,
  saved: (a, b) => a.saved - b.saved,
}

/**
 * Порядок по умолчанию — где пропусков больше, то и сверху: сводку открывают
 * именно за этим. При равенстве — по подписи, иначе строки с одинаковым числом
 * переставляются между запросами.
 */
export function sortAbsentGroups(
  rows: AbsentGroupRow[],
  sort: { id: string; desc: boolean } | null | undefined,
): AbsentGroupRow[] {
  const sorter = sort ? ABSENT_GROUP_SORTERS[sort.id] : undefined
  if (sorter) {
    return [...rows].sort(
      (a, b) => (sort!.desc ? -sorter(a, b) : sorter(a, b)) || a.label.localeCompare(b.label, 'ru'),
    )
  }
  return [...rows].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'))
}
