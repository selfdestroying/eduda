'use client'
import { Prisma, Student } from '@/prisma/generated/client'
import { AttendanceStatus } from '@/prisma/generated/enums'
import DragScrollArea from '@/src/components/drag-scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table'
import { cn, getFullName } from '@/src/lib/utils'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { formatDateOnly } from '@/src/lib/timezone'
import { ArrowDown, ArrowUp } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

// -------------------- Types --------------------
type AttendanceWithRelations = Prisma.AttendanceGetPayload<{
  include: {
    missedMakeup: { include: { makeUpAttendance: { include: { lesson: true } } } }
  }
}>

// -------------------- Utils --------------------
const formatDate = (date: Date) => formatDateOnly(date)

const statusClasses: Record<
  AttendanceStatus | 'TRIAL_PRESENT' | 'TRIAL_ABSENT' | 'TRIAL_UNSPECIFIED',
  string
> = {
  PRESENT: 'bg-success/20 text-success',
  ABSENT: 'bg-destructive/20 text-destructive',
  UNSPECIFIED: 'bg-muted/20 ',

  TRIAL_ABSENT: 'bg-linear-to-r from-info/20 to-destructive/20 text-destructive',
  TRIAL_PRESENT: 'bg-linear-to-r from-info/20 to-success/20 text-success',
  TRIAL_UNSPECIFIED: 'bg-linear-to-r from-info/20 to-info/20',
}

const makeupStatusClasses: Record<AttendanceStatus, string> = {
  PRESENT: 'outline-2 outline-success/50',
  ABSENT: 'outline-2 outline-destructive/50',
  UNSPECIFIED: '',
}

const stickyColumnClasses: Record<string, string> = {
  id_header: 'sticky left-0 z-[1]',
  name_header: 'sticky left-8 z-[1]',
  id: 'sticky left-0 bg-sidebar z-[1]',
  name: 'sticky left-8 bg-sidebar z-[1]',
}

type LessonWithAttendance = Prisma.LessonGetPayload<{
  include: {
    attendance: {
      include: {
        missedMakeup: { include: { makeUpAttendance: { include: { lesson: true } } } }
      }
    }
  }
}>

// -------------------- Attendance Cell --------------------
function AttendanceCell({
  lesson,
  attendance,
}: {
  lesson: LessonWithAttendance
  attendance?: AttendanceWithRelations
}) {
  if (!attendance) {
    return (
      <div className="inline-block">
        <div className="text-muted-foreground bg-muted/20 rounded-lg px-2">
          {formatDate(lesson.date)}
        </div>
      </div>
    )
  }

  const attendanceStatus =
    attendance.studentStatus == 'TRIAL'
      ? statusClasses[`TRIAL_${attendance.status}`]
      : statusClasses[attendance.status]
  const makeUpStatus = attendance.missedMakeup
    ? (makeupStatusClasses[attendance.missedMakeup.makeUpAttendance.status] ??
      makeupStatusClasses.UNSPECIFIED)
    : makeupStatusClasses.UNSPECIFIED

  return (
    <div className="inline-block">
      <Popover modal>
        <PopoverTrigger
          className={cn('cursor-pointer rounded-lg px-2', attendanceStatus, makeUpStatus)}
        >
          {formatDate(lesson.date)}
        </PopoverTrigger>
        <PopoverContent className="text-xs">
          <div className="space-y-1">
            <p>
              Урок –{' '}
              <Link
                href={`/dashboard/lessons/${attendance.lessonId}`}
                className="text-primary hover:underline"
              >
                {formatDate(lesson.date)}
              </Link>{' '}
              {attendance.status === 'PRESENT'
                ? '– Пришел'
                : attendance.status === 'ABSENT'
                  ? '– Пропустил'
                  : ''}
            </p>
            <p>
              Отработка –{' '}
              {attendance.missedMakeup ? (
                <>
                  <Link
                    href={`/dashboard/lessons/${attendance.missedMakeup.makeUpAttendance.lessonId}`}
                    className="text-primary hover:underline"
                  >
                    {formatDate(attendance.missedMakeup.makeUpAttendance.lesson.date)}
                  </Link>
                  {attendance.missedMakeup.makeUpAttendance.status === 'PRESENT'
                    ? ' – Пришел'
                    : attendance.missedMakeup.makeUpAttendance.status === 'ABSENT'
                      ? ' – Пропустил'
                      : ''}
                </>
              ) : (
                ' Не нужна'
              )}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// -------------------- Lookup --------------------
type AttendanceLookup = Map<number, Map<number, AttendanceWithRelations>>

function buildAttendanceLookup(lessons: LessonWithAttendance[]): AttendanceLookup {
  const map: AttendanceLookup = new Map()
  for (const lesson of lessons) {
    const studentMap = new Map<number, AttendanceWithRelations>()
    for (const att of lesson.attendance) {
      studentMap.set(att.studentId, att)
    }
    map.set(lesson.id, studentMap)
  }
  return map
}

// -------------------- Columns --------------------
const getColumns = (
  lessons: LessonWithAttendance[],
  lookup: AttendanceLookup,
): ColumnDef<Student>[] => [
  {
    id: 'id',
    header: '№',
    cell: ({ row }) => row.index + 1,
    size: 10,
  },
  {
    id: 'name',
    header: 'Полное имя',
    accessorFn: (student) => `${student.firstName} ${student.lastName}`,
    cell: ({ row }) => (
      <Link
        href={`/dashboard/students/${row.original.id}`}
        className="text-primary hover:underline"
      >
        {getFullName(row.original.firstName, row.original.lastName)}
      </Link>
    ),
    meta: { filterVariant: 'text' },
  },
  ...lessons.map<ColumnDef<Student>>((lesson) => ({
    id: `lesson-${lesson.id}`,
    cell: ({ row }) => {
      const attendance = lookup.get(lesson.id)?.get(row.original.id)
      if (!attendance) return null
      return <AttendanceCell lesson={lesson} attendance={attendance} />
    },
    size: 100,
  })),
]

// -------------------- Main Component --------------------
export function StudentAttendanceTable({
  lessons,
  students,
}: {
  lessons: LessonWithAttendance[]
  students: Student[]
}) {
  const lookup = useMemo(() => buildAttendanceLookup(lessons), [lessons])
  const columns = useMemo(() => getColumns(lessons, lookup), [lessons, lookup])

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  })

  return (
    <div className="space-y-2">
      <DragScrollArea
        initialScroll={
          (lessons.reduce((prev, curr) => prev + (curr.date < new Date() ? 1 : 0), 0) - 1) * 100
        }
      >
        <table
          data-slot="table"
          className="w-full border-separate border-spacing-0 [&_tr:not(:last-child)_td]:border-b"
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      className={cn(
                        'bg-sidebar border-border relative h-9 border-y select-none first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r',
                        stickyColumnClasses[header.id + '_header'],
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              'flex h-full cursor-pointer items-center gap-2 select-none',
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={(e) => {
                            // Enhanced keyboard handling for sorting
                            if (
                              header.column.getCanSort() &&
                              (e.key === 'Enter' || e.key === ' ')
                            ) {
                              e.preventDefault()
                              header.column.getToggleSortingHandler()?.(e)
                            }
                          }}
                          tabIndex={header.column.getCanSort() ? 0 : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: (
                              <ArrowUp
                                className="shrink-0 opacity-60"
                                size={16}
                                aria-hidden="true"
                              />
                            ),
                            desc: (
                              <ArrowDown
                                className="shrink-0 opacity-60"
                                size={16}
                                aria-hidden="true"
                              />
                            ),
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="h-px border-0 [&:first-child>td:first-child]:rounded-tl-lg [&:first-child>td:last-child]:rounded-tr-lg [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg"
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'h-[inherit] overflow-hidden last:py-0',
                          stickyColumnClasses[cell.column.id],
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent [&:first-child>td:first-child]:rounded-tl-lg [&:first-child>td:last-child]:rounded-tr-lg [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg">
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </DragScrollArea>
    </div>
  )
}
