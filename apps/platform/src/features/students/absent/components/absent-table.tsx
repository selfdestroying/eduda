'use client'

import PeriodFilter, { PERIOD_TITLE } from '@/src/components/period-filter'
import { useMappedCourseListQuery } from '@/src/features/courses/queries'
import { useMappedLocationListQuery } from '@/src/features/locations/queries'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { useClampPage } from '@/src/hooks/use-table-state'
import { formatDateOnly } from '@/src/lib/timezone'
import { getFullName, getGroupName } from '@/src/lib/utils'
import GroupSelect from '@/src/components/group-select'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import {
  type ColumnDef,
  type Table as TanstackTable,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { Fragment, useMemo } from 'react'
import { useAbsentFilters } from '../use-absent-filters'
import { useAbsentGroupsQuery, useAbsentListQuery } from '../queries'
import type { AbsentGroupBy } from '../schemas'
import type { AbsentGroupRow, AbsentListItem } from '../types'

/** Даты. Моноширинные цифры: без них столбик разъезжается на каждой единице. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — дат, локации, курса. */
const COLUMN_WIDTH = 130

/** Группа и преподаватели длиннее даты, но короче имени и комментария. */
const GROUP_WIDTH = 200
const TEACHER_WIDTH = 170

/** Внешняя ссылка ученика — колонка на одно слово. */
const LINK_WIDTH = 100

/** «Да»/«Нет» — колонка шириной со свой заголовок. */
const FLAG_WIDTH = 120

/**
 * Значения фильтров-признаков. `yes`/`no` вместо `true`/`false` — они едут в
 * адресную строку, а разбирает их `flagFilter` в `useAbsentFilters`.
 */
const YES_NO_OPTIONS = [
  { label: 'Да', value: 'yes' },
  { label: 'Нет', value: 'no' },
]

const MAKEUP_OPTIONS = [
  { label: 'Назначена', value: 'yes' },
  { label: 'Не назначена', value: 'no' },
]

const GROUP_MODES = ['none', 'student', 'group', 'course', 'teacher', 'location'] as const
type GroupMode = (typeof GROUP_MODES)[number]

const GROUP_MODE_LABELS: Record<GroupMode, string> = {
  none: 'Без группировки',
  student: 'По ученику',
  group: 'По группе',
  course: 'По курсу',
  teacher: 'По преподавателю',
  location: 'По локации',
}

/** Подпись колонки со свёрнутым измерением — она же заголовок и имя в меню. */
const GROUP_LABEL_TITLES: Record<AbsentGroupBy, string> = {
  student: 'Ученик',
  group: 'Группа',
  course: 'Курс',
  teacher: 'Преподаватель',
  location: 'Локация',
}

type FilterOption = { label: string; value: string }

interface ColumnOptions {
  courses: FilterOption[]
  locations: FilterOption[]
  teachers: FilterOption[]
}

function buildColumns({
  courses,
  locations,
  teachers,
}: ColumnOptions): ColumnDef<AbsentListItem>[] {
  return [
    {
      id: 'student',
      header: 'Ученик',
      accessorFn: (row) => getFullName(row.student.firstName, row.student.lastName),
      cell: ({ row }) => (
        <Link
          href={`/students/${row.original.student.id}`}
          className="text-primary hover:underline"
        >
          {getFullName(row.original.student.firstName, row.original.student.lastName)}
        </Link>
      ),
      meta: { title: 'Ученик', flexible: true },
      // Строка без ученика бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'date',
      header: 'Дата пропуска',
      accessorFn: (row) => row.lesson.date,
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatDateOnly(row.original.lesson.date),
      meta: { title: 'Дата пропуска', className: NUMERIC },
    },
    {
      id: 'group',
      header: 'Группа',
      accessorFn: (row) => getGroupName(row.lesson.group),
      size: GROUP_WIDTH,
      cell: ({ row }) => (
        <Link
          href={`/groups/${row.original.lesson.group.id}`}
          className="text-primary hover:underline"
        >
          {getGroupName(row.original.lesson.group)}
        </Link>
      ),
      // Сортировать по имени группы нечем: у части групп его нет вовсе, оно
      // собирается из курса и расписания уже здесь. По курсу — соседняя колонка.
      enableSorting: false,
      meta: { title: 'Группа' },
    },
    {
      id: 'teacher',
      header: 'Преподаватель',
      accessorFn: (row) => row.lesson.teachers.map((t) => t.teacher.name).join(', '),
      size: TEACHER_WIDTH,
      cell: ({ row }) => {
        const teachers = row.original.lesson.teachers
        if (teachers.length === 0) return '—'
        return teachers.map((t, index) => (
          <Fragment key={t.teacher.id}>
            {index > 0 && ', '}
            <Link
              href={`/organization/members/${t.teacher.id}`}
              className="text-primary hover:underline"
            >
              {t.teacher.name}
            </Link>
          </Fragment>
        ))
      },
      // Преподавателей у урока несколько — сортировать по списку имён нечего.
      enableSorting: false,
      meta: { title: 'Преподаватель', variant: 'multiSelect', options: teachers },
    },
    {
      id: 'location',
      header: 'Локация',
      accessorFn: (row) => row.lesson.group.location?.name ?? '',
      size: COLUMN_WIDTH,
      cell: ({ row }) => row.original.lesson.group.location?.name ?? '—',
      meta: { title: 'Локация', variant: 'multiSelect', options: locations },
    },
    {
      id: 'course',
      header: 'Курс',
      accessorFn: (row) => row.lesson.group.course.name,
      size: COLUMN_WIDTH,
      meta: { title: 'Курс', variant: 'multiSelect', options: courses },
    },
    {
      id: 'warned',
      header: 'Предупреждён',
      accessorFn: (row) => (row.isWarned ? 'Да' : 'Нет'),
      size: FLAG_WIDTH,
      cell: ({ row }) =>
        row.original.isWarned ? (
          'Да'
        ) : (
          // `isWarned` в базе nullable, и «не проставлено» для школы то же самое,
          // что «не предупреждал», — показываем их одинаково.
          <span className="text-muted-foreground">Нет</span>
        ),
      // Отбор идёт в SQL, а сортировки по признаку из двух значений хватает
      // фильтру — колонка на два значения сортируется галочкой.
      enableSorting: false,
      meta: { title: 'Предупреждён', variant: 'multiSelect', options: YES_NO_OPTIONS },
    },
    {
      id: 'makeup',
      header: 'Отработка',
      accessorFn: (row) => row.makeupAttendance?.lesson.date ?? '',
      size: COLUMN_WIDTH,
      cell: ({ row }) => {
        const { makeupAttendance, makeupForAttendance } = row.original
        if (makeupAttendance) {
          return (
            <Link
              href={`/lessons/${makeupAttendance.lessonId}`}
              className="text-primary hover:underline"
            >
              {formatDateOnly(makeupAttendance.lesson.date)}
            </Link>
          )
        }
        // Строка сама является отработкой другого пропуска — своей у неё нет и,
        // как правило, не будет.
        if (makeupForAttendance) {
          return (
            <Link
              href={`/lessons/${makeupForAttendance.lessonId}`}
              className="text-muted-foreground hover:underline"
            >
              за {formatDateOnly(makeupForAttendance.lesson.date)}
            </Link>
          )
        }
        return '—'
      },
      enableSorting: false,
      meta: {
        title: 'Отработка',
        className: NUMERIC,
        variant: 'multiSelect',
        options: MAKEUP_OPTIONS,
      },
    },
    {
      id: 'comment',
      header: 'Комментарий',
      accessorKey: 'comment',
      cell: ({ row }) => row.original.comment || '—',
      enableSorting: false,
      meta: { title: 'Комментарий', flexible: true },
    },
    {
      id: 'link',
      header: 'Ссылка',
      size: LINK_WIDTH,
      cell: ({ row }) => {
        const url = row.original.student.url
        if (!url) return '—'
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Открыть
          </a>
        )
      },
      enableSorting: false,
      meta: { title: 'Ссылка' },
    },
  ]
}

/**
 * Колонки сводки. Курс, преподаватель, локация, «Предупреждён» и «Отработка»
 * объявлены пустыми и скрытыми: панель фильтров собирается из `meta` колонок, и
 * без них отбор продолжал бы применяться, но исчез бы с экрана — таблица
 * оказалась бы молча урезанной. Показывать их в строке нечем: строка сводки это
 * уже несколько пропусков.
 */
function buildGroupColumns(
  by: AbsentGroupBy,
  { courses, locations, teachers }: ColumnOptions,
): ColumnDef<AbsentGroupRow>[] {
  const hidden = (
    id: string,
    title: string,
    options: FilterOption[],
  ): ColumnDef<AbsentGroupRow> => ({
    id,
    header: () => null,
    cell: () => null,
    enableSorting: false,
    meta: { title, variant: 'multiSelect', options },
  })

  return [
    {
      id: 'label',
      header: GROUP_LABEL_TITLES[by],
      accessorFn: (row) => row.label,
      cell: ({ row }) => {
        const { studentId, groupId, label, teachers: rowTeachers } = row.original
        if (studentId !== null) {
          return (
            <Link href={`/students/${studentId}`} className="text-primary hover:underline">
              {label}
            </Link>
          )
        }
        if (groupId !== null) {
          return (
            <Link href={`/groups/${groupId}`} className="text-primary hover:underline">
              {label}
            </Link>
          )
        }
        // Преподавателей у строки бывает несколько: пара ведёт одну общую
        // корзину, и ссылок в ней тоже две. Пустой список — «Без преподавателя».
        if (rowTeachers && rowTeachers.length > 0) {
          return rowTeachers.map((teacher, index) => (
            <Fragment key={teacher.id}>
              {index > 0 && ', '}
              <Link
                href={`/organization/members/${teacher.id}`}
                className="text-primary hover:underline"
              >
                {teacher.name}
              </Link>
            </Fragment>
          ))
        }
        return label
      },
      meta: { title: GROUP_LABEL_TITLES[by], flexible: true },
      enableHiding: false,
    },
    {
      id: 'count',
      header: 'Пропусков',
      accessorFn: (row) => row.count,
      size: COLUMN_WIDTH,
      meta: { title: 'Пропусков', className: NUMERIC },
    },
    {
      id: 'unwarned',
      header: 'Без предупреждения',
      accessorFn: (row) => row.unwarned,
      size: GROUP_WIDTH,
      meta: { title: 'Без предупреждения', className: NUMERIC },
    },
    // В разрезе «по ученику» колонка всегда показывала бы единицу.
    ...(by === 'student'
      ? []
      : [
          {
            id: 'students',
            header: 'Учеников',
            accessorFn: (row: AbsentGroupRow) => row.students,
            size: COLUMN_WIDTH,
            meta: { title: 'Учеников', className: NUMERIC },
          } satisfies ColumnDef<AbsentGroupRow>,
        ]),
    {
      id: 'lost',
      header: 'Потеряно, ₽',
      accessorFn: (row) => row.lost,
      size: COLUMN_WIDTH,
      cell: ({ row }) => row.original.lost.toLocaleString('ru-RU'),
      meta: { title: 'Потеряно, ₽', className: NUMERIC },
    },
    {
      id: 'saved',
      header: 'Спасено, ₽',
      accessorFn: (row) => row.saved,
      size: COLUMN_WIDTH,
      cell: ({ row }) => row.original.saved.toLocaleString('ru-RU'),
      meta: { title: 'Спасено, ₽', className: NUMERIC },
    },
    hidden('teacher', 'Преподаватель', teachers),
    hidden('location', 'Локация', locations),
    hidden('course', 'Курс', courses),
    hidden('warned', 'Предупреждён', YES_NO_OPTIONS),
    hidden('makeup', 'Отработка', MAKEUP_OPTIONS),
  ]
}

export default function AbsentTable() {
  // Отбор общий с графиком над таблицей — он живёт в `useAbsentFilters`.
  const { t, filters } = useAbsentFilters()
  const { columnFilters, pagination, sorting, period } = t

  // Всё состояние таблицы уезжает в запрос: сервер сам отбирает, сортирует и режет
  // на страницы.
  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      ...filters,
    }),
    [pagination, sorting, filters],
  )

  // Режим свёртки — в адресе, как и всё остальное состояние таблицы: ссылкой на
  // «пропуски по преподавателям за март» делятся так же, как на отфильтрованный
  // список.
  const [mode, setMode] = useQueryState(
    'by',
    parseAsStringLiteral(GROUP_MODES).withDefault('none').withOptions({
      shallow: true,
      history: 'replace',
    }),
  )
  const isGrouped = mode !== 'none'

  const flat = useAbsentListQuery(params, !isGrouped)
  // `by` при выключенном запросе значения не имеет, но схема ждёт его всегда.
  const grouped = useAbsentGroupsQuery({ ...params, by: isGrouped ? mode : 'student' }, isGrouped)

  const active = isGrouped ? grouped : flat
  const { isLoading, isFetching, isError } = active
  useClampPage(pagination, t.setPagination, active.data?.total)

  const { data: courses = [] } = useMappedCourseListQuery()
  const { data: locations = [] } = useMappedLocationListQuery()
  const { data: teachers = [] } = useMappedMemberListQuery()

  const options = useMemo(() => ({ courses, locations, teachers }), [courses, locations, teachers])
  const columns = useMemo(() => buildColumns(options), [options])
  const groupColumns = useMemo(
    () => buildGroupColumns(isGrouped ? mode : 'student', options),
    [mode, isGrouped, options],
  )

  // Общее у обеих таблиц: состояние живёт в одном `useTableState`, поэтому период,
  // отбор и поиск переживают переключение режима.
  const shared = {
    getCoreRowModel: getCoreRowModel(),
    // Отбор, порядок и нарезка — на сервере. Клиентские модели строк выключены,
    // поэтому `filterFn` у колонок нет: предикаты живут в `where` экшена.
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    onPaginationChange: t.setPagination,
    onColumnFiltersChange: t.setColumnFilters,
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
  } as const

  const flatTable = useReactTable({
    ...shared,
    data: flat.data?.rows ?? [],
    columns,
    // Ключ строки — id посещения, а не её место на странице.
    getRowId: (row) => String(row.id),
    // Иначе пагинации не из чего считать число страниц: она видит только текущую.
    rowCount: flat.data?.total ?? 0,
    state: { pagination, sorting, columnFilters, columnVisibility: t.columnVisibility },
  })

  const groupTable = useReactTable({
    ...shared,
    data: grouped.data?.rows ?? [],
    columns: groupColumns,
    getRowId: (row) => row.key,
    rowCount: grouped.data?.total ?? 0,
    state: {
      pagination,
      sorting,
      columnFilters,
      // Колонки отбора у сводки служебные и всегда скрыты: строка сводки — это
      // уже несколько пропусков, показывать в ней курс или отработку нечем.
      columnVisibility: {
        ...t.columnVisibility,
        course: false,
        teacher: false,
        location: false,
        warned: false,
        makeup: false,
      },
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError) {
    return <div className="text-destructive">Ошибка при загрузке пропусков.</div>
  }

  // Обе таблицы рисуются одинаково, а строки у них разного типа — отсюда дженерик:
  // разложить это в две ветки JSX значило бы держать две копии тулбара.
  const renderTable = <T,>(instance: TanstackTable<T>) => (
    <DataTable
      table={instance}
      emptyMessage="Нет пропусков."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      toolbar={
        <>
          <DataTableToolbar
            table={instance}
            search={t.globalFilter}
            onSearchChange={t.setGlobalFilter}
            searchPlaceholder="Ученик, группа, комментарий..."
            onReset={t.reset}
            extraFilterTitles={period.from || period.to ? [PERIOD_TITLE] : []}
          >
            <PeriodFilter value={period} onChange={t.setPeriod} />
          </DataTableToolbar>
          <GroupSelect
            value={mode}
            labels={GROUP_MODE_LABELS}
            onValueChange={(next) => {
              // Дефолт пишем как `null`, чтобы параметра в адресе не было вовсе.
              setMode(next === 'none' ? null : next)
              // Строк в другом режиме меньше: страница, оставшаяся от прошлого,
              // показала бы пустую таблицу.
              t.resetPage()
            }}
          />
        </>
      }
    />
  )

  return isGrouped ? renderTable(groupTable) : renderTable(flatTable)
}
