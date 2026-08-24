'use client'

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
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { Fragment, useMemo } from 'react'
import { useAbsentFilters } from '../use-absent-filters'
import { useAbsentListQuery } from '../queries'
import type { AbsentListItem } from '../types'

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

  const { data, isLoading, isFetching, isError } = useAbsentListQuery(params)
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
    // Ключ строки — id посещения, а не её место на странице.
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
    return <div className="text-destructive">Ошибка при загрузке пропусков.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет пропусков."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Ученик, группа, комментарий..."
          onReset={t.reset}
          extraFilterTitles={period.from || period.to ? [PERIOD_TITLE] : []}
        >
          <PeriodFilter value={period} onChange={t.setPeriod} />
        </DataTableToolbar>
      }
    />
  )
}
