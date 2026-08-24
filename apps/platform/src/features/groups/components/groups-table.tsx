'use client'

import { useMappedCourseListQuery } from '@/src/features/courses/queries'
import { useMappedLocationListQuery } from '@/src/features/locations/queries'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import {
  filterIds,
  filterValues,
  rangeValues,
  useClampPage,
  useTableState,
} from '@/src/hooks/use-table-state'
import { DaysOfWeek, getGroupName } from '@/src/lib/utils'
import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { Fragment, useMemo } from 'react'
import { useGroupListQuery } from '../queries'
import type { GroupListSchemaType } from '../schemas'
import type { GroupListItem } from '../types'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — чисел, локации, курса, типа. */
const COLUMN_WIDTH = 130

/** Расписание — до трёх строк «Пн 17:00», и переносить их незачем. */
const SCHEDULE_WIDTH = 120
const TEACHER_WIDTH = 170

/** Внешняя ссылка группы — колонка на одно слово. */
const LINK_WIDTH = 100

/**
 * Колонки, по которым фильтруем: `useTableState` держит их в URL, а отсюда они
 * уезжают в запрос. Всё строками, включая id, — значения приходят из адреса, и в
 * числа их превращает уже сборка параметров запроса.
 */
const TABLE_FILTERS = {
  course: 'string',
  location: 'string',
  teacher: 'string',
  status: 'string',
  students: 'range',
} as const

const STATUS_OPTIONS = [
  { label: 'Активная', value: 'ACTIVE' },
  { label: 'Завершена', value: 'COMPLETED' },
  { label: 'Архивная', value: 'ARCHIVED' },
]

const groupStatusConfig: Record<
  Exclude<GroupListItem['status'], 'ACTIVE'>,
  { label: string; variant: 'secondary' | 'success'; className?: string }
> = {
  ARCHIVED: { label: 'Архивная', variant: 'secondary', className: 'text-muted-foreground' },
  COMPLETED: { label: 'Завершена', variant: 'success' },
}

type FilterOption = { label: string; value: string }

interface ColumnOptions {
  courses: FilterOption[]
  locations: FilterOption[]
  teachers: FilterOption[]
}

function buildColumns({ courses, locations, teachers }: ColumnOptions): ColumnDef<GroupListItem>[] {
  return [
    {
      id: 'group',
      header: 'Группа',
      accessorFn: (row) => getGroupName(row),
      cell: ({ row }) => {
        const statusConfig =
          row.original.status === 'ACTIVE' ? null : groupStatusConfig[row.original.status]
        return (
          <div className="flex items-center gap-2">
            <Link href={`/groups/${row.original.id}`} className="text-primary hover:underline">
              {getGroupName(row.original)}
            </Link>
            {statusConfig && (
              <Badge variant={statusConfig.variant} className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            )}
          </div>
        )
      },
      // Сортировать по имени нечем: у части групп его нет вовсе, оно собирается
      // из курса и расписания уже здесь. По курсу — соседняя колонка.
      enableSorting: false,
      meta: { title: 'Группа', flexible: true },
      // Строка без названия группы бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'schedule',
      header: 'Расписание',
      size: SCHEDULE_WIDTH,
      cell: ({ row }) => {
        const schedules = row.original.schedules
        if (schedules.length === 0) return '—'
        // Неделя с понедельника: в базе `dayOfWeek` считается с воскресенья.
        const sorted = [...schedules].sort(
          (a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7),
        )
        return (
          <div className="flex flex-col gap-0.5">
            {sorted.map((s) => (
              <span key={s.dayOfWeek} className="text-sm">
                {DaysOfWeek.short[s.dayOfWeek]} {s.time}
              </span>
            ))}
          </div>
        )
      },
      enableSorting: false,
      meta: { title: 'Расписание', className: NUMERIC },
    },
    {
      id: 'course',
      header: 'Курс',
      accessorFn: (row) => row.course.name,
      size: COLUMN_WIDTH,
      meta: { title: 'Курс', variant: 'multiSelect', options: courses },
    },
    {
      id: 'teacher',
      header: 'Преподаватель',
      accessorFn: (row) => row.teachers.map((t) => t.teacher.name).join(', '),
      size: TEACHER_WIDTH,
      cell: ({ row }) => {
        const groupTeachers = row.original.teachers
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
      id: 'students',
      header: 'Учеников',
      accessorFn: (row) => row._count.students,
      size: COLUMN_WIDTH,
      meta: { title: 'Учеников', className: NUMERIC, variant: 'range' },
    },
    {
      id: 'location',
      header: 'Локация',
      accessorFn: (row) => row.location?.name ?? '',
      size: COLUMN_WIDTH,
      cell: ({ row }) => row.original.location?.name ?? '—',
      meta: { title: 'Локация', variant: 'multiSelect', options: locations },
    },
    {
      id: 'groupType',
      header: 'Тип',
      accessorFn: (row) => row.groupType?.name ?? '',
      size: COLUMN_WIDTH,
      cell: ({ row }) => row.original.groupType?.name ?? '—',
      meta: { title: 'Тип' },
    },
    {
      // Колонки как таковой у статуса нет — бейдж стоит рядом с названием. Она
      // объявлена, чтобы в тулбаре появился фильтр, и по умолчанию скрыта.
      id: 'status',
      header: 'Статус',
      accessorKey: 'status',
      size: COLUMN_WIDTH,
      cell: ({ row }) =>
        row.original.status === 'ACTIVE'
          ? 'Активная'
          : groupStatusConfig[row.original.status].label,
      meta: { title: 'Статус', variant: 'multiSelect', options: STATUS_OPTIONS },
    },
    {
      id: 'link',
      header: 'Ссылка в БО',
      size: LINK_WIDTH,
      cell: ({ row }) => {
        const url = row.original.url
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
      meta: { title: 'Ссылка в БО' },
    },
  ]
}

/** Статус — колонка ради фильтра: бейдж и так стоит рядом с названием. */
const DEFAULT_HIDDEN = { status: false }

export default function GroupsTable() {
  const t = useTableState({
    id: 'groups',
    filters: TABLE_FILTERS,
    defaultVisibility: DEFAULT_HIDDEN,
  })
  const { columnFilters, pagination, sorting } = t

  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: t.search,
      courseIds: filterIds(columnFilters, 'course'),
      locationIds: filterIds(columnFilters, 'location'),
      teacherIds: filterIds(columnFilters, 'teacher'),
      statuses: filterValues(columnFilters, 'status') as GroupListSchemaType['statuses'],
      studentsMin: rangeValues(columnFilters, 'students')[0] ?? null,
      studentsMax: rangeValues(columnFilters, 'students')[1] ?? null,
    }),
    [pagination, sorting, t.search, columnFilters],
  )

  const { data, isLoading, isFetching, isError } = useGroupListQuery(params)
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
    // Ключ строки — id группы, а не её место на странице: иначе после
    // перелистывания React переиспользует разметку под чужую запись.
    getRowId: (row) => String(row.id),
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
    return <div className="text-destructive">Ошибка при загрузке групп.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет групп."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      // Закрытая группа остаётся в списке, но читаться должна как закрытая —
      // одного бейджа в широкой строке не видно.
      rowClassName={(row) => (row.original.status === 'ACTIVE' ? undefined : 'opacity-55')}
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Группа, курс, локация..."
          onReset={t.reset}
        />
      }
    />
  )
}
