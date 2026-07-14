'use client'

import { Student } from '@/prisma/generated/client'
import { AttendanceStatus } from '@/prisma/generated/enums'
import DragScrollArea from '@/src/components/drag-scroll-area'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Separator } from '@/src/components/ui/separator'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { Toggle } from '@/src/components/ui/toggle'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { useUpdateAttendanceStatusMutation } from '@/src/features/lessons/queries'
import { formatDateOnly, moscowTodayYmd } from '@/src/lib/timezone'
import { cn, getFullName } from '@/src/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  Loader,
  MessageSquareText,
  Minus,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { groupKeys } from '../../queries'
import type { AttendanceWithRelations, LessonWithAttendance } from '../../types'

// -------------------- Utils --------------------
const formatDate = (date: string) => formatDateOnly(date)

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

// -------------------- Attendance Config --------------------
const ATTENDANCE_LABELS = {
  PRESENT: { label: 'Присутствовал', icon: CheckCircle2, class: 'text-success' },
  ABSENT: { label: 'Отсутствовал', icon: XCircle, class: 'text-destructive' },
  UNSPECIFIED: { label: 'Не отмечен', icon: Minus, class: 'text-muted-foreground' },
} as const

const toggleVariant = {
  present: {
    active: 'border-success aria-pressed:bg-success/20 text-success aria-pressed:opacity-100',
    inactive: '',
  },
  absent: {
    active:
      'border-destructive aria-pressed:bg-destructive/20 text-destructive aria-pressed:opacity-100',
    inactive: '',
  },
  unspecified: {
    active: '',
    inactive: '',
  },
} as const

// -------------------- Attendance Cell --------------------
function AttendanceCell({
  lesson,
  attendance,
  groupId,
}: {
  lesson: LessonWithAttendance
  attendance: AttendanceWithRelations
  groupId: number
}) {
  const queryClient = useQueryClient()
  const { data: hasPermission } = useOrganizationPermissionQuery({
    studentLesson: ['selectWarned'],
  })
  const { mutate, isPending } = useUpdateAttendanceStatusMutation(attendance.lessonId)
  const [optimisticStatus, setOptimisticStatus] = useState<AttendanceStatus | null>(null)
  const [showWarnedChoice, setShowWarnedChoice] = useState(false)

  if (!attendance) {
    return (
      <div className="inline-block">
        <div className="text-muted-foreground bg-muted/20 rounded-lg px-2">
          {formatDate(lesson.date)}
        </div>
      </div>
    )
  }

  const currentStatus = optimisticStatus ?? attendance.status

  const handleStatusChange = (newStatus: AttendanceStatus, isWarned?: boolean) => {
    if (newStatus === attendance.status && isWarned === undefined) return

    setOptimisticStatus(newStatus)
    setShowWarnedChoice(false)

    mutate(
      {
        studentId: attendance.studentId,
        lessonId: attendance.lessonId,
        status: newStatus,
        isWarned: isWarned ?? null,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
        },
        onError: () => {
          setOptimisticStatus(null)
        },
      },
    )
  }

  const handleAbsentClick = () => {
    if (currentStatus === 'ABSENT') return
    if (hasPermission?.success) {
      setShowWarnedChoice(true)
    } else {
      handleStatusChange('ABSENT', false)
    }
  }

  const attendanceStatus =
    (optimisticStatus ?? attendance.isTrial)
      ? statusClasses[`TRIAL_${currentStatus}`]
      : statusClasses[currentStatus]
  const makeUpStatus = attendance.makeupAttendance
    ? (makeupStatusClasses[attendance.makeupAttendance.status] ?? makeupStatusClasses.UNSPECIFIED)
    : makeupStatusClasses.UNSPECIFIED

  const config = ATTENDANCE_LABELS[currentStatus] ?? ATTENDANCE_LABELS.UNSPECIFIED
  const StatusIcon = config.icon

  return (
    <div className="inline-block">
      <Popover
        onOpenChange={(open) => {
          if (!open) setShowWarnedChoice(false)
        }}
      >
        <PopoverTrigger
          className={cn('cursor-pointer rounded-lg px-2', attendanceStatus, makeUpStatus)}
        >
          {formatDate(lesson.date)}
        </PopoverTrigger>
        <PopoverContent className="text-xs" align="center">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isPending ? (
                <Loader className="text-muted-foreground size-3 animate-spin" />
              ) : (
                <StatusIcon className={cn('size-3', config.class)} />
              )}
              <span className={cn('font-medium', config.class)}>{config.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {attendance.isTrial && (
                <Badge variant="secondary" className="text-[0.5625rem]">
                  Пробный
                </Badge>
              )}
              {attendance.isWarned && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-500/10 text-[0.5625rem] text-amber-600 dark:border-amber-800 dark:text-amber-400"
                >
                  <AlertTriangle data-icon="inline-start" />
                  Предупредил
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Lesson info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Урок</span>
              <Link
                href={`/lessons/${attendance.lessonId}`}
                className="text-primary hover:underline"
              >
                {formatDate(lesson.date)}
                {lesson.time ? `, ${lesson.time}` : ''}
              </Link>
            </div>

            {/* Makeup info */}
            {currentStatus === 'ABSENT' && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <ArrowRightLeft className="size-3" />
                  Отработка
                </span>
                {attendance.makeupAttendance ? (
                  <span className="flex items-center gap-2">
                    {attendance.makeupAttendance.status === 'PRESENT' ? (
                      <CheckCircle2 className="text-success size-3" />
                    ) : attendance.makeupAttendance.status === 'ABSENT' ? (
                      <XCircle className="text-destructive size-3" />
                    ) : null}
                    <Link
                      href={`/lessons/${attendance.makeupAttendance.lessonId}`}
                      className="text-primary hover:underline"
                    >
                      {formatDate(attendance.makeupAttendance.lesson.date)}
                    </Link>
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Не назначена</span>
                )}
              </div>
            )}

            {/* Comment */}
            {attendance.comment && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <MessageSquareText className="text-muted-foreground size-3 shrink-0" />
                  <span className="text-muted-foreground">{attendance.comment}</span>
                </div>
              </>
            )}
          </div>

          <Separator />

          {/* Quick status toggle */}
          {showWarnedChoice ? (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="h-7 flex-1 text-xs"
                disabled={isPending}
                onClick={() => handleStatusChange('ABSENT', false)}
              >
                Не предупредил (−1)
              </Button>
              <Button
                size="sm"
                className="bg-success/10 text-success hover:bg-success/20 h-7 flex-1 text-xs"
                disabled={isPending}
                onClick={() => handleStatusChange('ABSENT', true)}
              >
                Предупредил (0)
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Изменить</span>
              <div className="flex gap-1">
                <Toggle
                  size="sm"
                  variant="outline"
                  className={cn(
                    'cursor-pointer',
                    toggleVariant.present[currentStatus === 'PRESENT' ? 'active' : 'inactive'],
                  )}
                  pressed={currentStatus === 'PRESENT'}
                  disabled={isPending || currentStatus === 'PRESENT'}
                  onClick={() => handleStatusChange('PRESENT')}
                >
                  <Check />
                </Toggle>
                <Toggle
                  size="sm"
                  variant="outline"
                  className={cn(
                    'cursor-pointer',
                    toggleVariant.absent[currentStatus === 'ABSENT' ? 'active' : 'inactive'],
                  )}
                  pressed={currentStatus === 'ABSENT'}
                  disabled={isPending || currentStatus === 'ABSENT'}
                  onClick={handleAbsentClick}
                >
                  <X />
                </Toggle>
                <Toggle
                  size="sm"
                  variant="outline"
                  className={cn(
                    'cursor-pointer',
                    toggleVariant.unspecified[
                      currentStatus === 'UNSPECIFIED' ? 'active' : 'inactive'
                    ],
                  )}
                  pressed={currentStatus === 'UNSPECIFIED'}
                  disabled={isPending || currentStatus === 'UNSPECIFIED'}
                  onClick={() => handleStatusChange('UNSPECIFIED')}
                >
                  <Minus />
                </Toggle>
              </div>
            </div>
          )}
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
  groupId: number,
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
      <Link href={`/students/${row.original.id}`} className="text-primary hover:underline">
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
      return <AttendanceCell lesson={lesson} attendance={attendance} groupId={groupId} />
    },
    size: 100,
  })),
]

// -------------------- Main Component --------------------
export function GroupAttendanceTable({
  lessons,
  currentStudents,
  groupId,
}: {
  lessons: LessonWithAttendance[]
  currentStudents: Student[]
  groupId: number
}) {
  const [isPending, startTransition] = useTransition()
  const [showAll, setShowAll] = useState(false)

  const allStudents = useMemo(() => {
    const regularIds = new Set<number>()
    const map = new Map<number, Student>()
    for (const lesson of lessons) {
      for (const att of lesson.attendance) {
        if (!att.makeupForAttendanceId) regularIds.add(att.studentId)
        if (!map.has(att.studentId)) map.set(att.studentId, att.student)
      }
    }
    return [...map.values()].filter((s) => regularIds.has(s.id))
  }, [lessons])

  const lookup = useMemo(() => buildAttendanceLookup(lessons), [lessons])

  const hasFormerStudents = allStudents.length > currentStudents.length
  const data = showAll ? allStudents : currentStudents
  const columns = useMemo(() => getColumns(lessons, lookup, groupId), [lessons, lookup, groupId])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  })

  return (
    <div className="space-y-2">
      {hasFormerStudents && (
        <div className="flex items-center gap-2">
          <Tabs
            value={showAll ? 'all' : 'current'}
            onValueChange={(val) => startTransition(() => setShowAll(val === 'all'))}
            aria-label="Переключить отображение учеников"
          >
            <TabsList>
              <TabsTrigger value="current" disabled={isPending}>
                {isPending ? <Loader className="animate-spin" /> : <Users />}
                Текущие ученики
              </TabsTrigger>
              <TabsTrigger value="all" disabled={isPending}>
                {isPending ? <Loader className="animate-spin" /> : <Users />}
                Все ученики
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      <DragScrollArea
        initialScroll={
          (lessons.reduce((prev, curr) => prev + (curr.date <= moscowTodayYmd() ? 1 : 0), 0) - 1) *
          100
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
