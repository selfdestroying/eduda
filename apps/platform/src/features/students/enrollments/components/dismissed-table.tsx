'use client'

import PeriodFilter, { PERIOD_TITLE } from '@/src/components/period-filter'
import { useMappedCourseListQuery } from '@/src/features/courses/queries'
import { useMappedLocationListQuery } from '@/src/features/locations/queries'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { filterIds, useClampPage, useTableState } from '@/src/hooks/use-table-state'
import { formatDateOnly } from '@/src/lib/timezone'
import { getFullName, getGroupName } from '@/src/lib/utils'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { Fragment, useMemo } from 'react'
import { useEnrollmentListQuery } from '../queries'
import type { EnrollmentListItem } from '../types'
import DismissedActions from './dismissed-actions'

/** Даты. Моноширинные цифры: без них столбик разъезжается на каждой единице. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — дат, локации, курса. */
const COLUMN_WIDTH = 130

/** Группа и преподаватели длиннее даты, но короче имени и комментария. */
const GROUP_WIDTH = 200
const TEACHER_WIDTH = 170

/** Внешняя ссылка ученика — колонка на одно слово. */
const LINK_WIDTH = 100

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Колонки, по которым фильтруем: `useTableState` держит их в URL, а отсюда они
 * уезжают в запрос. Всё строками, включая id, — значения приходят из адреса, и в
 * числа их превращает уже сборка параметров запроса.
 */
const TABLE_FILTERS = {
  course: 'string',
  location: 'string',
  teacher: 'string',
} as const

/** Страница показывает только отчисленных; человек этот отбор не меняет. */
const STATUSES = ['DISMISSED'] as const

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
      cell: ({ row }) =>
        row.original.statusChangedAt ? formatDateOnly(row.original.statusChangedAt) : '—',
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

export default function DismissedTable() {
  const t = useTableState({ id: 'dismissed', filters: TABLE_FILTERS })
  const { columnFilters, pagination, sorting, period } = t

  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: t.search,
      statuses: [...STATUSES],
      from: period.from ?? undefined,
      to: period.to ?? undefined,
      courseIds: filterIds(columnFilters, 'course'),
      locationIds: filterIds(columnFilters, 'location'),
      teacherIds: filterIds(columnFilters, 'teacher'),
    }),
    [pagination, sorting, t.search, period, columnFilters],
  )

  const { data, isLoading, isFetching, isError } = useEnrollmentListQuery(params)
  useClampPage(pagination, t.setPagination, data?.total)

  const { data: courses = [] } = useMappedCourseListQuery()
  const { data: locations = [] } = useMappedLocationListQuery()
  const { data: teachers = [] } = useMappedMemberListQuery()

  const columns = useMemo(
    () => buildColumns({ courses, locations, teachers }),
    [courses, locations, teachers],
  )

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Ключ строки — составной первичный ключ записи, а не её место на странице.
    getRowId: (row) => `${row.studentId}-${row.groupId}`,
    // Отбор, порядок и нарезка — в SQL. Клиентские модели строк выключены, поэтому
    // `filterFn` у колонок нет: предикаты живут в `where` серверного экшена.
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    // Иначе пагинации не из чего считать число страниц: она видит только текущую.
    rowCount: data?.total ?? 0,
    onPaginationChange: t.setPagination,
    onColumnFiltersChange: t.setColumnFilters,
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: {
      pagination,
      sorting,
      columnFilters,
      columnVisibility: t.columnVisibility,
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

  return (
    <DataTable
      table={table}
      emptyMessage="Нет отчисленных учеников."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Ученик, группа, причина..."
          onReset={t.reset}
          extraFilterTitles={period.from || period.to ? [PERIOD_TITLE] : []}
        >
          <PeriodFilter value={period} onChange={t.setPeriod} />
        </DataTableToolbar>
      }
    />
  )
}
