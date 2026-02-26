'use client'
import { DismissedWithStudentAndGroup } from '@/src/actions/dismissed'
import CourseLocationTeacherFilters from '@/src/components/course-location-teacher-filters'
import DataTable from '@/src/components/data-table'
import { FieldGroup } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/data/user/session-query'
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
import { formatDateOnly } from '@/src/lib/timezone'
import Link from 'next/link'
import DismissedActions from './dismissed-actions'

const columns: ColumnDef<DismissedWithStudentAndGroup>[] = [
  {
    header: 'Имя',
    accessorFn: (value) => value.studentId,
    cell: ({ row }) => (
      <Link
        href={`/dashboard/students/${row.original.studentId}`}
        className="text-primary hover:underline"
      >
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
      <Link
        href={`/dashboard/groups/${row.original.groupId}`}
        className="text-primary hover:underline"
      >
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
                href={`/dashboard/organization/members/${t.teacher.id}`}
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
      <p className="max-w-52 truncate" title={row.original.comment || ''}>
        {row.original.comment || '-'}
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
    accessorKey: 'date',
    cell: ({ row }) => formatDateOnly(row.original.date),
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DismissedActions
        dismissedId={row.original.id}
        groupId={row.original.groupId}
        studentId={row.original.studentId}
        studentName={getFullName(row.original.student.firstName, row.original.student.lastName)}
      />
    ),
  },
]

export default function DismissedStudentsTable({ data }: { data: DismissedWithStudentAndGroup[] }) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId

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
    search: true,
    sorting: true,
    pagination: true,
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
        row.original.student.lastName
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

  if (isSessionLoading || !session) {
    return <Skeleton className="h-full w-full" />
  }

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
            organizationId={organizationId!}
            columnFilters={columnFilters}
            setFilters={setColumnFilters}
          />
        </FieldGroup>
      }
    />
  )
}
