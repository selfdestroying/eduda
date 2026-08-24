'use client'

import { useMappedCourseListQuery } from '@/src/features/courses/queries'
import { useMappedLocationListQuery } from '@/src/features/locations/queries'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { filterIds, useClampPage, useTableState } from '@/src/hooks/use-table-state'
import { getFullName, getGroupName } from '@/src/lib/utils'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Hint } from '@repo/ui/components/hint'
import { Skeleton } from '@repo/ui/components/skeleton'
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { Fragment, useMemo } from 'react'
import { useEnrollmentListQuery } from '../queries'
import type { EnrollmentListSchemaType } from '../schemas'
import type { EnrollmentListItem } from '../types'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — чисел, локации, курса. */
const COLUMN_WIDTH = 130

/** Группа и преподаватели длиннее числа, но короче имени. */
const GROUP_WIDTH = 200
const TEACHER_WIDTH = 170

/** Внешняя ссылка ученика — колонка на одно слово. */
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
} as const

/** Баланс ниже этого — ученику скоро потребуется оплата, и его видно красным. */
const LOW_BALANCE = 2

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
      id: 'totalPayments',
      header: 'Оплат',
      accessorFn: (row) => row.wallet?.totalPayments ?? 0,
      size: COLUMN_WIDTH,
      // Сортировка выключена: суммы лежат на кошельке, а его у записи может не
      // быть — по nullable-связи Prisma расставляет строки непредсказуемо.
      enableSorting: false,
      meta: { title: 'Оплат', className: NUMERIC },
    },
    {
      id: 'totalLessons',
      header: 'Уроков',
      accessorFn: (row) => row.wallet?.totalLessons ?? 0,
      size: COLUMN_WIDTH,
      enableSorting: false,
      meta: { title: 'Уроков', className: NUMERIC },
    },
    {
      id: 'lessonsBalance',
      header: () => (
        <span className="flex items-center gap-0.5">
          Баланс уроков
          <Hint text="Оставшееся количество оплаченных уроков. Красным выделяются ученики с балансом менее 2 - им скоро потребуется оплата." />
        </span>
      ),
      accessorFn: (row) => row.wallet?.lessonsBalance ?? 0,
      size: COLUMN_WIDTH,
      enableSorting: false,
      cell: ({ row }) => {
        const balance = row.original.wallet?.lessonsBalance ?? 0
        return (
          <span className={balance < LOW_BALANCE ? 'text-destructive' : undefined}>{balance}</span>
        )
      },
      meta: { title: 'Баланс уроков', className: NUMERIC },
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

interface EnrollmentsTableProps {
  /** Какие записи показывать — задаёт страница, а не человек. */
  statuses: EnrollmentListSchemaType['statuses']
  /** Свой id на страницу: иначе «Активные» и «Завершившие» делят настройку колонок. */
  tableId: string
  emptyMessage: string
}

/**
 * «Активные» и «Завершившие» — одна и та же таблица с разным `statuses`: колонки,
 * фильтры и поиск у них совпадали до последнего символа, и две копии расходились
 * при каждой правке.
 */
export default function EnrollmentsTable({
  statuses,
  tableId,
  emptyMessage,
}: EnrollmentsTableProps) {
  const t = useTableState({ id: tableId, filters: TABLE_FILTERS })
  const { columnFilters, pagination, sorting } = t

  // Стабилизируем по значению: страница передаёт литерал, и с новой ссылкой на
  // каждый рендер параметры запроса пересобирались бы впустую.
  const statusesKey = statuses.join(',')
  const statusList = useMemo(
    () => statusesKey.split(',') as EnrollmentListSchemaType['statuses'],
    [statusesKey],
  )

  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: t.search,
      statuses: statusList,
      courseIds: filterIds(columnFilters, 'course'),
      locationIds: filterIds(columnFilters, 'location'),
      teacherIds: filterIds(columnFilters, 'teacher'),
    }),
    [pagination, sorting, t.search, columnFilters, statusList],
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
    // Ключ строки — составной первичный ключ записи, а не её место на странице:
    // иначе после перелистывания React переиспользует разметку под чужую запись.
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
    return <div className="text-destructive">Ошибка при загрузке учеников.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage={emptyMessage}
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Ученик, группа, курс..."
          onReset={t.reset}
        />
      }
    />
  )
}
