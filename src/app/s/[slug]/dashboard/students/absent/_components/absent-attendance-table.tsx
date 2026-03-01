'use client'
import { AttendanceWithStudents } from '@/src/actions/attendance'
import CourseLocationTeacherFilters from '@/src/components/course-location-teacher-filters'
import DataTable from '@/src/components/data-table'
import { Button } from '@/src/components/ui/button'
import { Calendar, CalendarDayButton } from '@/src/components/ui/calendar'
import { FieldGroup } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/data/user/session-query'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { getFullName, getGroupName } from '@/src/lib/utils'
import {
  ColumnDef,
  ColumnFiltersState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { startOfDay } from 'date-fns'
import { formatDateOnly } from '@/src/lib/timezone'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { parseAsIsoDate, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { DateRange } from 'react-day-picker'

const columns: ColumnDef<AttendanceWithStudents>[] = [
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
    accessorFn: (value) => value.lesson.group.id,
    cell: ({ row }) => (
      <Link
        href={`/dashboard/groups/${row.original.lesson.group.id}`}
        className="text-primary hover:underline"
      >
        {getGroupName(row.original.lesson.group)}
      </Link>
    ),
    filterFn: (row, id, filterValue) => {
      return filterValue.length === 0 || filterValue.includes(row.original.lesson.group.course.id)
    },
  },
  {
    id: 'teacher',
    header: 'Преподаватель',
    cell: ({ row }) => {
      const teachers = row.original.lesson.group.teachers
      if (!teachers || teachers.length === 0) return <span>-</span>
      return (
        <div className="flex gap-x-1">
          {teachers.map((t, index) => (
            <span key={t.teacher.id}>
              <Link
                href={`/dashboard/organization/members/${t.teacher.id}`}
                className="text-primary hover:underline"
              >
                {t.teacher.name}
              </Link>
              {index < teachers.length - 1 && ', '}
            </span>
          ))}
        </div>
      )
    },
    filterFn: (row, columnId, filterValue) => {
      const teacherIds = row.original.lesson.group.teachers?.map((t) => t.teacher.id) ?? []
      return (
        filterValue.length === 0 || teacherIds.some((teacherId) => filterValue.includes(teacherId))
      )
    },
  },
  {
    header: 'Комментарий',
    cell: ({ row }) => row.original.comment,
  },
  {
    id: 'location',
    header: 'Локация',
    cell: ({ row }) => row.original.lesson.group.location?.name ?? '-',
    filterFn: (row, id, filterValue) => {
      return (
        filterValue.length === 0 || filterValue.includes(row.original.lesson.group.location?.id)
      )
    },
  },
  {
    id: 'date',
    header: 'Дата пропуска',
    accessorKey: 'lesson.date',
    cell: ({ row }) => formatDateOnly(row.original.lesson.date),
    filterFn: (row, columnId, filterValue) => {
      const lessonDate = startOfDay(new Date(row.getValue<Date>(columnId)))
      const fromDate = startOfDay(new Date(filterValue.from))
      const toDate = startOfDay(new Date(filterValue.to))
      return lessonDate >= fromDate && lessonDate <= toDate
    },
  },
]

export default function StudentsTable({ data }: { data: AttendanceWithStudents[] }) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId

  const {
    columnFilters: baseColumnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    sorting,
    setSorting,
  } = useTableSearchParams({
    filters: { course: 'integer', location: 'integer', teacher: 'integer' },
    search: true,
    pagination: true,
    sorting: true,
  })

  // Date range filter - managed separately via URL params
  const [dateFrom, setDateFrom] = useQueryState(
    'dateFrom',
    parseAsIsoDate.withOptions({ shallow: true }),
  )
  const [dateTo, setDateTo] = useQueryState('dateTo', parseAsIsoDate.withOptions({ shallow: true }))

  const range: DateRange | undefined = useMemo(() => {
    if (dateFrom && dateTo) return { from: dateFrom, to: dateTo }
    if (dateFrom) return { from: dateFrom }
    return undefined
  }, [dateFrom, dateTo])

  // Combine base column filters with date range filter
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const filters = [...baseColumnFilters]
    if (dateFrom && dateTo) {
      filters.push({
        id: 'date',
        value: {
          from: dateFrom,
          to: dateTo,
        },
      })
    }
    return filters
  }, [baseColumnFilters, dateFrom, dateTo])

  const handleDateRangeChangeFilter = (newRange: DateRange | undefined) => {
    setDateFrom(newRange?.from ?? null)
    setDateTo(newRange?.to ?? null)
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,

    state: {
      globalFilter,
      pagination,
      sorting,
      columnFilters,
    },
  })

  if (isSessionLoading || !session) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет учеников."
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
            columnFilters={baseColumnFilters}
            setFilters={setColumnFilters}
          />
          <Popover>
            <PopoverTrigger
              render={
                <Button id="date" variant="outline" className="w-fit">
                  {range?.from && range?.to
                    ? `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`
                    : 'Выбрать дату'}
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={handleDateRangeChangeFilter}
                locale={ru}
                components={{
                  DayButton: (props) => (
                    <CalendarDayButton
                      {...props}
                      data-day={props.day.date.toLocaleDateString('ru-RU')}
                    />
                  ),
                }}
              />
            </PopoverContent>
          </Popover>
        </FieldGroup>
      }
    />
  )
}
