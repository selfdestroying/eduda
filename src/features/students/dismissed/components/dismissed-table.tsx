'use client'
import CourseLocationTeacherFilters from '@/src/components/course-location-teacher-filters'
import DataTable from '@/src/components/data-table'
import { FieldGroup } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useDismissedListQuery } from '@/src/features/students/dismissed/queries'
import { DismissedWithStudentAndGroup } from '@/src/features/students/dismissed/types'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatDateOnly } from '@/src/lib/timezone'
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
import DismissedActions from './dismissed-actions'

const columns: ColumnDef<DismissedWithStudentAndGroup>[] = [
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
    filterFn: (row, id, filterValue) => {
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
    header: 'Комментарий',
    cell: ({ row }) => (
      <p className="max-w-52 truncate" title={row.original.statusComment || ''}>
        {row.original.statusComment || '-'}
      </p>
    ),
  },
  {
    id: 'location',
    header: 'Локация',
    cell: ({ row }) => row.original.group.location?.name,
    filterFn: (row, id, filterValue) => {
      return filterValue.length === 0 || filterValue.includes(row.original.group.location?.id)
    },
  },
  {
    header: 'Дата отчисления',
    accessorKey: 'statusChangedAt',
    cell: ({ row }) =>
      row.original.statusChangedAt ? formatDateOnly(row.original.statusChangedAt) : '-',
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DismissedActions
        groupId={row.original.groupId}
        studentId={row.original.studentId}
        studentName={getFullName(row.original.student.firstName, row.original.student.lastName)}
      />
    ),
  },
]

export default function DismissedStudentsTable() {
  const { data = [], isLoading, isError } = useDismissedListQuery()

  const {
    columnFilters,
    pagination,
    setPagination,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
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
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      const fullName = getFullName(
        row.original.student.firstName,
        row.original.student.lastName,
      ).toLowerCase()
      return fullName.includes(searchValue)
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,

    onSortingChange: setSorting,
    state: {
      columnFilters,
      globalFilter,
      sorting,
      pagination,
    },
  })

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }
  if (isError) return <div className="text-destructive">Ошибка загрузки</div>

  return (
    <DataTable
      table={table}
      emptyMessage="Нет отчисленных учеников."
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
