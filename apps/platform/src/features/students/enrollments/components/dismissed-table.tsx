'use client'

import GroupSelect from '@/src/components/group-select'
import PeriodFilter, { PERIOD_TITLE } from '@/src/components/period-filter'
import { useMappedCourseListQuery } from '@/src/features/courses/queries'
import { useMappedLocationListQuery } from '@/src/features/locations/queries'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { useClampPage } from '@/src/hooks/use-table-state'
import { formatDateOnly } from '@/src/lib/timezone'
import { getFullName, getGroupName } from '@/src/lib/utils'
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
import { useEnrollmentGroupsQuery, useEnrollmentListQuery } from '../queries'
import type { EnrollmentListItem } from '../types'
import { useEnrollmentFilters } from '../use-enrollment-filters'
import DismissedActions from './dismissed-actions'
import {
  GROUP_MODES,
  GROUP_MODE_LABELS,
  buildGroupColumns,
  type ColumnOptions,
  type GroupMode,
} from './enrollments-table'

/** Даты. Моноширинные цифры: без них столбик разъезжается на каждой единице. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — дат, локации, курса. */
const COLUMN_WIDTH = 130

/** Группа и преподаватели длиннее даты, но короче имени и причины. */
const GROUP_WIDTH = 200
const TEACHER_WIDTH = 170

/** Внешняя ссылка ученика — колонка на одно слово. */
const LINK_WIDTH = 100

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/** Страница показывает только отчисленных; человек этот отбор не меняет. */
const STATUSES = ['DISMISSED'] as const

function buildColumns({
  courses,
  locations,
  teachers,
}: ColumnOptions): ColumnDef<EnrollmentListItem>[] {
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
      // Дата отчисления — то, ради чего в этот список заходят: по ней видно, кто
      // ушёл на этой неделе. Поэтому она сразу за именем.
      id: 'statusChangedAt',
      header: 'Дата отчисления',
      accessorKey: 'statusChangedAt',
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatDateOnly(row.original.statusChangedAt),
      meta: { title: 'Дата отчисления', className: NUMERIC },
    },
    {
      id: 'group',
      header: 'Группа',
      accessorFn: (row) => getGroupName(row.group),
      size: GROUP_WIDTH,
      cell: ({ row }) => (
        <Link href={`/groups/${row.original.group.id}`} className="text-primary hover:underline">
          {getGroupName(row.original.group)}
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
      accessorFn: (row) => row.group.teachers.map((t) => t.teacher.name).join(', '),
      size: TEACHER_WIDTH,
      cell: ({ row }) => {
        const groupTeachers = row.original.group.teachers
        if (groupTeachers.length === 0) return '—'
        return groupTeachers.map((t, index) => (
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
      // Преподавателей у группы несколько — сортировать по списку имён нечего.
      enableSorting: false,
      meta: { title: 'Преподаватель', variant: 'multiSelect', options: teachers },
    },
    {
      id: 'course',
      header: 'Курс',
      accessorFn: (row) => row.group.course.name,
      size: COLUMN_WIDTH,
      meta: { title: 'Курс', variant: 'multiSelect', options: courses },
    },
    {
      id: 'location',
      header: 'Локация',
      accessorFn: (row) => row.group.location?.name ?? '',
      size: COLUMN_WIDTH,
      cell: ({ row }) => row.original.group.location?.name ?? '—',
      meta: { title: 'Локация', variant: 'multiSelect', options: locations },
    },
    {
      id: 'comment',
      header: 'Причина',
      accessorKey: 'statusComment',
      cell: ({ row }) => row.original.statusComment || '—',
      enableSorting: false,
      meta: { title: 'Причина', flexible: true },
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
    {
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => (
        <DismissedActions studentId={row.original.studentId} groupId={row.original.groupId} />
      ),
    },
  ]
}

interface DismissedTableProps {
  /** Тот же id, что у графика над таблицей: период и фильтры у них общие. */
  tableId: string
}

export default function DismissedTable({ tableId }: DismissedTableProps) {
  // Отбор общий с графиком над таблицей — он живёт в `useEnrollmentFilters`.
  // Статусы в него не входят: их задаёт страница.
  const { t, filters } = useEnrollmentFilters({ id: tableId })
  const { columnFilters, pagination, sorting, period } = t

  // Всё состояние таблицы уезжает в запрос: сервер сам отбирает, сортирует и режет
  // на страницы. Период здесь, в отличие от «Активных», осмыслен: у отчисленного
  // `statusChangedAt` — это день ухода, а не день заведения записи.
  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      statuses: [...STATUSES],
      ...filters,
    }),
    [pagination, sorting, filters],
  )

  // Режим свёртки — в адресе, как и всё остальное состояние таблицы: ссылкой на
  // «отчисленных по преподавателям за март» делятся так же, как на
  // отфильтрованный список.
  const [mode, setMode] = useQueryState(
    'by',
    parseAsStringLiteral(GROUP_MODES).withDefault('none').withOptions({
      shallow: true,
      history: 'replace',
    }),
  )
  const isGrouped = mode !== 'none'

  const flat = useEnrollmentListQuery(params, !isGrouped)
  // `by` при выключенном запросе значения не имеет, но схема ждёт его всегда.
  const grouped = useEnrollmentGroupsQuery({ ...params, by: isGrouped ? mode : 'group' }, isGrouped)

  const active = isGrouped ? grouped : flat
  const { isLoading, isFetching, isError } = active
  useClampPage(pagination, t.setPagination, active.data?.total)

  const { data: courses = [] } = useMappedCourseListQuery()
  const { data: locations = [] } = useMappedLocationListQuery()
  const { data: teachers = [] } = useMappedMemberListQuery()

  const options = useMemo(() => ({ courses, locations, teachers }), [courses, locations, teachers])
  const columns = useMemo(() => buildColumns(options), [options])
  const groupColumns = useMemo(
    () => buildGroupColumns(isGrouped ? mode : 'group', options, 'Отчислений'),
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
    // Ключ строки — составной первичный ключ записи, а не её место на странице.
    getRowId: (row) => `${row.studentId}-${row.groupId}`,
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
      // уже несколько отчислений, показывать в ней курс или преподавателя нечем.
      columnVisibility: { ...t.columnVisibility, course: false, teacher: false, location: false },
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
    return <div className="text-destructive">Ошибка при загрузке отчисленных.</div>
  }

  // Обе таблицы рисуются одинаково, а строки у них разного типа — отсюда дженерик:
  // разложить это в две ветки JSX значило бы держать две копии тулбара.
  const renderTable = <T,>(instance: TanstackTable<T>) => (
    <DataTable
      table={instance}
      emptyMessage="Нет отчисленных учеников."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      toolbar={
        <>
          <DataTableToolbar
            table={instance}
            search={t.globalFilter}
            onSearchChange={t.setGlobalFilter}
            searchPlaceholder="Ученик, группа, причина..."
            onReset={t.reset}
            extraFilterTitles={period.from || period.to ? [PERIOD_TITLE] : []}
          >
            <PeriodFilter value={period} onChange={t.setPeriod} />
          </DataTableToolbar>
          <GroupSelect
            value={mode}
            labels={GROUP_MODE_LABELS}
            onValueChange={(next: GroupMode) => {
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
