'use client'

import { Prisma } from '@/prisma/generated/client'
import CourseLocationTeacherFilters from '@/src/components/course-location-teacher-filters'
import { Calendar, CalendarDayButton } from '@/src/components/ui/calendar'
import { Card, CardContent, CardFooter } from '@/src/components/ui/card'
import { Skeleton } from '@/src/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table'
import { useDayStatusesQuery, useLessonListQuery } from '@/src/data/lesson/lesson-list-query'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { moscowNow, normalizeDateOnly } from '@/src/lib/timezone'
import { cn } from '@/src/lib/utils'
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react'
import Link from 'next/link'
import { createParser, useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'
import { CalendarDay } from 'react-day-picker'

const parseAsLocalDate = createParser({
  parse: (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    if (isNaN(date.getTime())) return null
    return date
  },
  serialize: (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },
})

const LESSON_COLUMNS: ColumnDef<LessonWithDetails>[] = [
  {
    header: 'Урок',
    cell: (info) => (
      <Link
        href={`/dashboard/lessons/${info.row.original.id}`}
        className="text-primary hover:underline"
      >
        Ссылка
      </Link>
    ),
  },
  {
    header: 'Ученики',
    accessorFn: (lesson) => lesson.attendance.length,
    cell: (info) => info.getValue(),
  },
  {
    id: 'course',
    header: 'Курс',
    accessorKey: 'group.course.id',
    cell: ({ row }) => row.original.group.course.name,
    filterFn: (row, columnId, filterValue) => {
      return filterValue.length === 0 || filterValue.includes(row.original.group.course.id)
    },
  },
  {
    header: 'Время',
    accessorKey: 'time',
    cell: (info) => info.getValue(),
  },
  {
    id: 'teacher',
    header: 'Учителя',
    cell: ({ row }) => (
      <div className="flex gap-x-1">
        {row.original.teachers.length === 0 ? (
          <span>-</span>
        ) : (
          row.original.teachers.map((t, index) => (
            <span key={t.teacher.id}>
              <Link
                href={`/dashboard/organization/members/${t.teacher.id}`}
                className="text-primary hover:underline"
              >
                {t.teacher.name}
              </Link>
              {index < row.original.teachers.length - 1 && ', '}
            </span>
          ))
        )}
      </div>
    ),
    filterFn: (row, columnId, filterValue) => {
      const teacherIds = row.original.teachers.map((t) => t.teacher.id)
      return (
        filterValue.length === 0 || teacherIds.some((teacherId) => filterValue.includes(teacherId))
      )
    },
  },
  {
    id: 'location',
    header: 'Локация',
    accessorFn: (lesson) => lesson.group.location?.id,
    cell: (info) => info.row.original.group.location?.name,
    filterFn: (row, columnId, filterValue) => {
      return filterValue.length === 0 || filterValue.includes(row.original.group.location?.id)
    },
  },

  {
    header: 'Отметки',
    accessorFn: (lesson) =>
      lesson.attendance.some((a) => a.status === 'UNSPECIFIED') ? 'unmarked' : 'marked',
    cell: (info) =>
      info.getValue() === 'marked' ? (
        <div className="text-success flex items-center gap-2">
          <Check className="size-4" />
        </div>
      ) : (
        <div className="text-destructive flex items-center gap-2">
          <X className="size-4" />
        </div>
      ),
  },
  {
    header: 'Статус',
    accessorKey: 'status',
    cell: (info) => (
      <span className={info.getValue() === 'ACTIVE' ? 'text-success' : 'text-muted-foreground'}>
        {info.getValue() === 'ACTIVE' ? 'Активен' : 'Неактивен'}
      </span>
    ),
  },
]

type LessonWithDetails = Prisma.LessonGetPayload<{
  include: {
    attendance: true
    group: { include: { course: true; location: true } }
    teachers: { include: { teacher: true } }
  }
}>

export default function Dashboard() {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const { data: hasPermission, isLoading: isPermissionLoading } = useOrganizationPermissionQuery({
    lesson: ['readAll'],
  })

  const [selectedDay, setSelectedDay] = useQueryState(
    'date',
    parseAsLocalDate
      .withDefault(normalizeDateOnly(moscowNow()))
      .withOptions({ shallow: true, history: 'replace' })
  )

  const { columnFilters, setColumnFilters } = useTableSearchParams({
    filters: { course: 'integer', location: 'integer', teacher: 'integer' },
  })

  const dayKey = useMemo(() => startOfDay(selectedDay), [selectedDay])
  const columns = useMemo(() => LESSON_COLUMNS, [])

  const organizationId = session?.organizationId
  const { data: lessons } = useLessonListQuery(organizationId!, dayKey)
  const canReadAllLessons = !!hasPermission?.success
  const lockedTeacherId =
    !canReadAllLessons && session?.user?.id != null ? Number(session.user.id) : undefined
  const effectiveFilters = useMemo(() => {
    if (!lockedTeacherId) return columnFilters
    const otherFilters = columnFilters.filter((filter) => filter.id !== 'teacher')
    return [
      ...otherFilters,
      {
        id: 'teacher',
        value: [lockedTeacherId],
      },
    ]
  }, [columnFilters, lockedTeacherId])

  if (isSessionLoading || isPermissionLoading || !session) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[2fr_3fr] gap-2 md:grid-cols-[auto_1fr] md:grid-rows-1">
      <Card className="overflow-y-auto">
        <CardContent>
          <LessonCalendar
            organizationId={organizationId!}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </CardContent>
        <CardFooter>
          <CourseLocationTeacherFilters
            organizationId={organizationId!}
            columnFilters={columnFilters}
            setFilters={setColumnFilters}
            lockedTeacherId={lockedTeacherId}
            disableTeacherFilter={!!lockedTeacherId}
            wrapInFieldGroup
          />
        </CardFooter>
      </Card>

      <Card>
        <CardContent className="overflow-y-auto">
          <DataTable data={lessons ?? []} columns={columns} filters={effectiveFilters} />
        </CardContent>
      </Card>
    </div>
  )
}

interface LessonCalendarProps {
  organizationId: number
  selectedDay: Date
  onSelectDay: (day: Date) => void
}

function LessonCalendar({ organizationId, selectedDay, onSelectDay }: LessonCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState<Date>(moscowNow())
  const dayKey = useMemo(() => startOfDay(selectedMonth), [selectedMonth])
  const { data: daysStatuses, isLoading: isDaysStatusesLoading } = useDayStatusesQuery(
    organizationId,
    dayKey
  )

  return (
    <Calendar
      mode="single"
      required
      selected={selectedDay}
      onSelect={onSelectDay}
      month={selectedMonth}
      onMonthChange={setSelectedMonth}
      classNames={{ week: 'flex gap-2 mt-2' }}
      showOutsideDays={false}
      locale={ru}
      disabled={isDaysStatusesLoading}
      disableNavigation={isDaysStatusesLoading}
      className="bg-transparent p-0 [--cell-size:--spacing(8)]"
      components={{
        DayButton: (props) =>
          isDaysStatusesLoading ? (
            <CalendarDayButton {...props} />
          ) : (
            <LessonDayButton {...props} daysStatuses={daysStatuses!} />
          ),
      }}
    />
  )
}

interface CalendarDayButtonProps extends React.ComponentProps<typeof CalendarDayButton> {
  day: CalendarDay
  children?: React.ReactNode
  daysStatuses: Record<string, boolean[]>
}

function LessonDayButton({ day, children, daysStatuses, ...props }: CalendarDayButtonProps) {
  const dayIndex = daysStatuses[normalizeDateOnly(day.date).toISOString().split('T')[0]]
  if (!dayIndex)
    return (
      <CalendarDayButton {...props} day={day}>
        {children}
      </CalendarDayButton>
    )

  const dayStatus = dayIndex.some(Boolean) ? 'unmarked' : 'marked'
  const statusClassNames = {
    unmarked: 'bg-destructive/20 text-destructive',
    marked: 'bg-success/20 text-success',
  }

  return (
    <CalendarDayButton
      {...props}
      day={day}
      className={cn(statusClassNames[dayStatus] || '', 'transition-none')}
      data-day={day.date.toLocaleDateString('ru-RU')}
    >
      {children}
    </CalendarDayButton>
  )
}

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  filters?: ColumnFiltersState
}

function DataTable<T>({ data, columns, filters }: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      columnFilters: filters,
    },
  })

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <div
                      className={cn(
                        header.column.getCanSort() &&
                          'flex w-fit cursor-pointer items-center gap-2 select-none'
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(e) => {
                        // Enhanced keyboard handling for sorting
                        if (header.column.getCanSort() && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          header.column.getToggleSortingHandler()?.(e)
                        }
                      }}
                      tabIndex={header.column.getCanSort() ? 0 : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ArrowUp className="shrink-0 opacity-60" size={16} />,
                        desc: <ArrowDown className="shrink-0 opacity-60" size={16} />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                Нет уроков в этот день.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
