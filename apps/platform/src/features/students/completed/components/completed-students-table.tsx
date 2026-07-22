'use client'
import CourseLocationTeacherFilters from '@/src/components/course-location-teacher-filters'
import DataTable from '@/src/components/data-table'
import { Hint } from '@/src/components/hint'
import { FieldGroup } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { ActiveStudent } from '@/src/features/students/active/types'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { getFullName, getGroupName } from '@/src/lib/utils'
import {
  ColumnDef,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useCompletedListQuery } from '../queries'

const columns: ColumnDef<ActiveStudent>[] = [
  {
    header: 'Имя',
    accessorFn: (value) => value.studentId,
    cell: ({ row }) => (
      <Link href={`/students/${row.original.studentId}`} className="text-primary hover:underline">
        {getFullName(row.original.student.firstName, row.original.student.lastName)}
      </Link>
    ),
  },
  {
    header: 'Ссылка',
    cell: ({ row }) => (
      <a
        href={row.original.student.url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        Ссылка
      </a>
    ),
  },
  {
    id: 'course',
    header: 'Группа',
    accessorFn: (value) => value.groupId,
    cell: ({ row }) => (
      <Link href={`/groups/${row.original.groupId}`} className="text-primary hover:underline">
        {getGroupName(row.original.group)}
      </Link>
    ),
    filterFn: (row, columnId, filterValue) => {
      return filterValue.length === 0 || filterValue.includes(row.original.group.course.id)
    },
  },
  {
    id: 'teacher',
    header: 'Учителя',
    cell: ({ row }) => (
      <div className="flex gap-x-1">
        {row.original.group.teachers.length === 0 ? (
          <span>-</span>
        ) : (
          row.original.group.teachers.map((t, index) => (
            <span key={t.teacher.id}>
              <Link
                href={`/organization/members/${t.teacher.id}`}
                className="text-primary hover:underline"
              >
                {t.teacher.name}
              </Link>
              {index < row.original.group.teachers.length - 1 && ', '}
            </span>
          ))
        )}
      </div>
    ),
    filterFn: (row, columnId, filterValue) => {
      const teacherIds = row.original.group.teachers.map((t) => t.teacher.id)
      return (
        filterValue.length === 0 || teacherIds.some((teacherId) => filterValue.includes(teacherId))
      )
    },
  },
  {
    id: 'location',
    header: 'Локация',
    accessorFn: (value) => value.group.location?.id,
    cell: ({ row }) => row.original.group.location?.name,
    filterFn: (row, columnId, filterValue) => {
      return filterValue.length === 0 || filterValue.includes(row.original.group.location?.id)
    },
  },
  {
    header: 'Оплат',
    accessorFn: (row) => row.wallet?.totalPayments ?? 0,
  },
  {
    header: 'Уроков',
    accessorFn: (row) => row.wallet?.totalLessons ?? 0,
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
    cell: ({ row }) => {
      const balance = row.original.wallet?.lessonsBalance ?? 0
      return <span className={balance < 2 ? 'text-destructive' : undefined}>{balance}</span>
    },
  },
]

export default function CompletedStudentsTable() {
  const { data = [], isLoading, isError } = useCompletedListQuery()

  const {
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    sorting,
    setSorting,
  } = useTableSearchParams({
    filters: { course: 'integer', location: 'integer', teacher: 'integer' },
  })

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      const fullName = getFullName(
        row.original.student.firstName,
        row.original.student.lastName,
      ).toLowerCase()
      return fullName.includes(searchValue)
    },
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),

    state: {
      columnFilters,
      globalFilter,
      pagination,
      sorting,
    },
  })

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }
  if (isError) return <div className="text-destructive">Ошибка загрузки</div>

  return (
    <DataTable
      table={table}
      emptyMessage="Нет завершенных учеников."
      showPagination
      toolbar={
        <FieldGroup className="flex flex-col items-end gap-2 md:flex-row">
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Поиск..."
          />
          <CourseLocationTeacherFilters
            columnFilters={columnFilters}
            setFilters={setColumnFilters}
          />
        </FieldGroup>
      }
    />
  )
}
