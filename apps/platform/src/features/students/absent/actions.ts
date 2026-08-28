'use server'

import { Prisma, prisma } from '@repo/db'
import { permissionAction } from '@/src/lib/safe-action'
import { getFullName, getGroupName } from '@/src/lib/utils'
import { foldAbsentGroups, sortAbsentGroups, type AbsentDimensions } from './group'
import {
  AbsentChartSchema,
  AbsentGroupsSchema,
  AbsentListSchema,
  type AbsentChartSchemaType,
} from './schemas'
import {
  ABSENT_GROUP_SELECT,
  ABSENT_LIST_SELECT,
  type AbsentChartPoint,
  type AbsentGroupItem,
  type AbsentGroupsResult,
  type AbsentListResult,
} from './types'

type AbsentOrderBy = Prisma.AttendanceOrderByWithRelationInput

/**
 * Разрешённые колонки сортировки: id колонки таблицы → как её сортировать. Белый
 * список, а не подстановка поля из запроса: `sort` приходит из адресной строки.
 * Неизвестный ключ даёт порядок по умолчанию, без ошибки.
 *
 * Преподавателя здесь нет: их у урока несколько, и «сортировка по списку имён»
 * ничего осмысленного не означает.
 */
const ABSENT_ORDER_BY: Record<string, (dir: Prisma.SortOrder) => AbsentOrderBy[]> = {
  student: (dir) => [{ student: { firstName: dir } }, { student: { lastName: dir } }],
  date: (dir) => [{ lesson: { date: dir } }],
  course: (dir) => [{ lesson: { group: { course: { name: dir } } } }],
  location: (dir) => [{ lesson: { group: { location: { name: dir } } } }],
}

/**
 * Порядок строк. Последним ключом всегда `id`: без него строки с равной датой при
 * листании переставляются местами, и один и тот же пропуск успевает показаться на
 * двух страницах подряд.
 */
function resolveOrderBy(sort: { id: string; desc: boolean } | null | undefined): AbsentOrderBy[] {
  const build = sort ? ABSENT_ORDER_BY[sort.id] : undefined
  if (!sort || !build) return [{ lesson: { date: 'desc' } }, { id: 'desc' }]
  return [...build(sort.desc ? 'desc' : 'asc'), { id: 'desc' }]
}

/**
 * Поиск по тому, что видно в строке: ученик, группа, комментарий.
 *
 * Слова требуются все, но каждое может найтись в любом поле — иначе «Иван Петров»
 * не нашёл бы никого: имя и фамилия лежат в разных колонках, и `contains` по
 * каждой в отдельности не совпадёт с целой фразой. Заодно работает «Петров Иван».
 */
function searchWhere(search: string | undefined): Prisma.AttendanceWhereInput[] {
  const terms = search?.split(/\s+/).filter(Boolean) ?? []

  return terms.map((term) => {
    const contains = { contains: term, mode: 'insensitive' as const }
    return {
      OR: [
        { student: { firstName: contains } },
        { student: { lastName: contains } },
        { comment: contains },
        { lesson: { group: { name: contains } } },
        { lesson: { group: { course: { name: contains } } } },
      ],
    }
  })
}

/**
 * Отбор, общий для таблицы и графика: тот же период, те же курс, локация и
 * преподаватель, тот же поиск. Один на двоих не ради экономии строк — иначе
 * столбик графика не сходился бы с числом строк под ним.
 *
 * Пропуски отдаются все, включая те, которым уже назначена отработка: раньше их
 * прятал жёсткий предикат, теперь этим заведует фильтр «Отработка» в тулбаре —
 * решает тот, кто смотрит.
 */
function absentWhere(
  input: AbsentChartSchemaType,
  organizationId: number,
): Prisma.AttendanceWhereInput {
  const { search, from, to, courseIds, locationIds, teacherIds, isWarned, hasMakeup } = input

  // Всё, что отбирает по уроку, собираем в один объект: `lesson` в `where` может
  // быть только один, и период с фильтрами по группе и преподавателю обязаны
  // лечь в него вместе, а не затирать друг друга.
  const lessonWhere: Prisma.LessonWhereInput = {
    // Отменённого урока не было — значит не было и пропуска на нём. Отметки при
    // отмене не снимаются (`cancelLesson` двигает только статус урока), поэтому
    // отсекаем их здесь: иначе в списке висят пропуски занятий, которых не
    // случилось, а в деньгах — списания по ним.
    status: 'ACTIVE',
    // Границы включительные и сравниваются как строки — `date` это date-only
    // колонка `YYYY-MM-DD`, где лексикографический порядок совпадает с
    // хронологическим.
    ...((from || to) && {
      date: { ...(from && { gte: from }), ...(to && { lte: to }) },
    }),
    ...(teacherIds.length > 0 && { teachers: { some: { teacherId: { in: teacherIds } } } }),
    ...((courseIds.length > 0 || locationIds.length > 0) && {
      group: {
        ...(courseIds.length > 0 && { courseId: { in: courseIds } }),
        ...(locationIds.length > 0 && { locationId: { in: locationIds } }),
      },
    }),
  }

  // Признаки кладём в `AND` рядом с поиском: у «не предупреждал» два значения в
  // базе (`false` и NULL), и одним полем в `where` это не выражается.
  const and: Prisma.AttendanceWhereInput[] = searchWhere(search)
  if (isWarned !== undefined) {
    and.push(isWarned ? { isWarned: true } : { OR: [{ isWarned: false }, { isWarned: null }] })
  }
  if (hasMakeup !== undefined) {
    and.push({ makeupAttendance: hasMakeup ? { isNot: null } : { is: null } })
  }

  return {
    organizationId,
    status: 'ABSENT',
    ...(and.length > 0 && { AND: and }),
    // Без условия: в `lessonWhere` всегда есть хотя бы статус урока, так что
    // проверять его на пустоту больше нечего.
    lesson: lessonWhere,
  }
}

export const getAbsentAttendances = permissionAction({ student: ['read'] })
  .metadata({ actionName: 'getAbsentAttendances' })
  .inputSchema(AbsentListSchema)
  .action(async ({ ctx, parsedInput }): Promise<AbsentListResult> => {
    const { page, pageSize, sort } = parsedInput
    const where = absentWhere(parsedInput, ctx.session.organizationId!)

    // Одной транзакцией: строки и их количество обязаны быть посчитаны по одному и
    // тому же состоянию базы, иначе между запросами кто-то отметит отработку и
    // «страница 3 из 5» разъедется с тем, что реально вернулось.
    const [rows, total] = await prisma.$transaction([
      prisma.attendance.findMany({
        where,
        select: ABSENT_LIST_SELECT,
        orderBy: resolveOrderBy(sort),
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.attendance.count({ where }),
    ])

    return { rows, total }
  })

/**
 * Измерения пропуска для свёртки. Имена разрешаются здесь, а не в `group.ts`:
 * `getGroupName` собирает подпись группы из курса и расписания, когда своего
 * имени у неё нет, и свёртка остаётся без зависимостей.
 */
function toDimensions(row: AbsentGroupItem): AbsentDimensions {
  // Ключ преподавателей — по отсортированным id, чтобы «Иванов, Петров» и
  // «Петров, Иванов» попали в одну корзину. Подпись собирается в том же порядке.
  const teachers = [...row.lesson.teachers].map((t) => t.teacher).sort((a, b) => a.id - b.id)
  return {
    studentId: row.studentId,
    studentName: getFullName(row.student.firstName, row.student.lastName),
    groupId: row.lesson.group.id,
    groupName: getGroupName(row.lesson.group),
    courseId: row.lesson.group.course.id,
    courseName: row.lesson.group.course.name,
    locationId: row.lesson.group.location?.id ?? null,
    locationName: row.lesson.group.location?.name ?? null,
    teacherKey: teachers.length === 0 ? 'none' : teachers.map((t) => t.id).join(','),
    teachers,
    // `isWarned` в базе nullable: предупреждением считаем ровно `true`.
    isWarned: row.isWarned === true,
    price: row.price,
    makeupAttended: row.makeupAttendance?.status === 'PRESENT',
    makeupPrice: row.makeupAttendance?.price ?? null,
  }
}

/**
 * Сводка: те же пропуски, свёрнутые по ученику, группе, курсу, преподавателю или
 * локации. Отбор — тот же `absentWhere`, что у списка и графика, поэтому сумма
 * `count` по всем строкам сводки равна числу строк списка; это сторожит
 * `scripts/check-absent-groups.ts`.
 *
 * Пагинация идёт по корзинам, а не по пропускам: строк тут столько, сколько
 * получилось групп.
 *
 * ponytail: под свёртку читаются все отобранные пропуски разом — 2848 на самой
 * большой школе сегодня. Начнёт тормозить: свёртка по ученику, группе, курсу и
 * локации выражается через `groupBy`, а набор преподавателей нет, и ради него всё
 * равно понадобится сырой SQL.
 */
export const getAbsentGroups = permissionAction({ student: ['read'] })
  .metadata({ actionName: 'getAbsentGroups' })
  .inputSchema(AbsentGroupsSchema)
  .action(async ({ ctx, parsedInput }): Promise<AbsentGroupsResult> => {
    const { page, pageSize, sort, by } = parsedInput

    const rows = await prisma.attendance.findMany({
      where: absentWhere(parsedInput, ctx.session.organizationId!),
      select: ABSENT_GROUP_SELECT,
    })

    const folded = sortAbsentGroups(foldAbsentGroups(by, rows.map(toDimensions)), sort)

    return {
      rows: folded.slice(page * pageSize, page * pageSize + pageSize),
      total: folded.length,
    }
  })

/**
 * Точки графика: сколько пропусков за календарный день, отдельно предупреждённых
 * и нет. Отбор — тот же `absentWhere`, что у таблицы, поэтому график показывает
 * ровно отобранное в тулбаре, а не всю школу.
 *
 * Дальше день остаётся строкой `YYYY-MM-DD` — в недели, месяцы и годы их
 * складывает браузер, поэтому переключение вида графика на сервер не ходит.
 */
export const getAbsentChartPoints = permissionAction({ student: ['read'] })
  .metadata({ actionName: 'getAbsentChartPoints' })
  .inputSchema(AbsentChartSchema)
  .action(async ({ ctx, parsedInput }): Promise<AbsentChartPoint[]> => {
    const rows = await prisma.attendance.findMany({
      where: absentWhere(parsedInput, ctx.session.organizationId!),
      select: {
        isWarned: true,
        // Цена, застывшая в момент списания. `null` — списания не было: либо
        // пропуск предупреждённый, либо занятие ещё ждёт оплаты. И то и другое
        // для родителя стоит нуля, поэтому выдумывать цену здесь нечем и незачем.
        price: true,
        // Статус и цена отработки: по ним считаются спасённые деньги. Списание
        // предупреждённого пропуска происходит не на нём, а на отработке, поэтому
        // цена берётся отсюда.
        makeupAttendance: { select: { status: true, price: true } },
        lesson: { select: { date: true } },
      },
    })

    const byDate = new Map<string, AbsentChartPoint>()
    for (const row of rows) {
      const point = byDate.get(row.lesson.date) ?? {
        date: row.lesson.date,
        warned: 0,
        unwarned: 0,
        lost: 0,
        saved: 0,
      }
      // `isWarned` — nullable: предупреждением считаем ровно `true`, остальное
      // (в том числе не проставленный флаг) идёт в непредупреждённые.
      if (row.isWarned) {
        point.warned++
        // Предупредил и отходил: занятие списалось на отработке, а не пропало.
        // Назначенная, но ещё не проведённая отработка ничего не спасает — деньги
        // спасает посещение, а не запись.
        if (row.makeupAttendance?.status === 'PRESENT') {
          point.saved += row.makeupAttendance.price ?? 0
        }
      } else {
        point.unwarned++
        // Тем же условием, что и списание (`isLessonCharged`): непредупреждённый
        // пропуск снимает занятие с пакета, предупреждённый — нет.
        point.lost += row.price ?? 0
      }
      byDate.set(point.date, point)
    }

    // Порядок точек задаётся здесь: браузер раскладывает их по корзинам подряд и
    // на отсортированность полагается.
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  })
