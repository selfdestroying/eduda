'use client'

import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/empty'
import { Input } from '@repo/ui/components/input'
import { Skeleton } from '@repo/ui/components/skeleton'
import AttendanceActions from '@/src/features/lessons/components/attendance-actions'
import { AttendanceStatusSwitcher } from '@/src/features/lessons/components/attendance-status-switcher'
import { useUpdateAttendanceCommentMutation } from '@/src/features/lessons/queries'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { formatDateOnly, nowInTz } from '@/src/lib/timezone'
import { cn, getFullName } from '@/src/lib/utils'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { debounce } from 'es-toolkit'
import {
  Calendar,
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  RefreshCw,
  SquareArrowOutUpRight,
} from 'lucide-react'
import Link from 'next/link'
import { createParser, useQueryStates } from 'nuqs'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useDashboardMonthQuery } from '../queries'
import { DASHBOARD_MONTH_KEY_REGEX } from '../schemas'
import type {
  DashboardCalendarDaySummaryMap,
  DashboardLessonItem,
  DashboardMonthData,
} from '../types'
import { FiltersDrawer } from '@/src/features/calendar/components/filters-drawer'
import { useEventFilters } from '@/src/features/calendar/hooks/use-event-filters'
import type { FilterableEvent, FilterDimension } from '@/src/features/calendar/types'
import { LessonCalendar } from './lesson-calendar'

const QUERY_STATE_OPTIONS = { shallow: true, history: 'push' as const }

/** Типов групп в месячном снапшоте нет — секцию не показываем. */
const DASHBOARD_FILTER_DIMENSIONS: FilterDimension[] = ['course', 'location', 'teacher']

/** Урок панели → форма, понятная фильтрам календаря. */
function toFilterableEvent(lesson: DashboardLessonItem): FilterableEvent {
  return {
    courseId: lesson.group.course.id,
    title: lesson.group.course.name,
    locationId: lesson.group.location?.id ?? 0,
    location: lesson.group.location?.name ?? 'Без локации',
    groupTypeId: 0,
    groupType: 'Без типа',
    teachers: lesson.teachers,
  }
}

function getTodayInTz(tz: string) {
  const today = nowInTz(tz)
  return new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

function parseLocalDate(value: string) {
  const parts = value.split('-').map(Number)
  const [year = 0, month = 0, day = 0] = parts
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function serializeLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseMonthKeyToDate(monthKey: string) {
  const [year = 0, month = 1] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function clampDateToMonth(date: Date, month: Date) {
  const lastDayOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return new Date(month.getFullYear(), month.getMonth(), Math.min(date.getDate(), lastDayOfMonth))
}

function toMonthLabel(date: Date) {
  const label = format(date, 'LLLL yyyy', { locale: ru })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const localDateParser = createParser({
  parse: parseLocalDate,
  serialize: serializeLocalDate,
})

const monthKeyParser = createParser({
  parse: (value: string) => (DASHBOARD_MONTH_KEY_REGEX.test(value) ? value : null),
  serialize: (value: string) => value,
})

export default function Dashboard() {
  const tz = useOrgTimezone()
  const today = useMemo(() => getTodayInTz(tz), [tz])
  const DEFAULT_MONTH_KEY = getMonthKey(today)

  const [pageState, setPageState] = useQueryStates(
    {
      month: monthKeyParser.withDefault(DEFAULT_MONTH_KEY),
      date: localDateParser.withDefault(today),
    },
    QUERY_STATE_OPTIONS,
  )

  const visibleMonth = parseMonthKeyToDate(pageState.month)

  useEffect(() => {
    const nextSelectedDay = clampDateToMonth(pageState.date, visibleMonth)

    if (serializeLocalDate(nextSelectedDay) !== serializeLocalDate(pageState.date)) {
      void setPageState({ date: nextSelectedDay })
    }
  }, [pageState.date, setPageState, visibleMonth])

  const { data, isPending, isError, error, isFetching, refetch } = useDashboardMonthQuery(
    pageState.month,
  )

  const selectedDayKey = serializeLocalDate(pageState.date)
  const selectedDayData = data?.days.find((day) => day.date === selectedDayKey) ?? null

  // Фильтры — та же машинка, что у нового календаря: категории считаются по всем
  // урокам месяца, а не только выбранного дня.
  const monthEvents = useMemo(
    () => data?.days.flatMap((day) => day.lessons).map(toFilterableEvent) ?? [],
    [data],
  )
  const filters = useEventFilters(monthEvents, DASHBOARD_FILTER_DIMENSIONS)
  const isLessonVisible = (lesson: DashboardLessonItem) =>
    filters.isVisible(toFilterableEvent(lesson))
  const visibleLessons = selectedDayData?.lessons.filter(isLessonVisible) ?? []
  const daySummaries = buildCalendarDaySummaryMap(data, isLessonVisible)

  const handleSelectDay = (day: Date) => {
    void setPageState({ date: day })
  }

  const handleMonthChange = (month: Date) => {
    void setPageState({
      month: getMonthKey(month),
      date: clampDateToMonth(pageState.date, month),
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <Card className={cn(isFetching && data && 'opacity-80')}>
            <CardHeader>
              <CardTitle>Календарь месяца</CardTitle>
            </CardHeader>

            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {toMonthLabel(visibleMonth)}
                  </p>
                </div>
                {isFetching && (
                  <Badge variant="outline" className="animate-pulse">
                    Обновляем
                  </Badge>
                )}
              </div>

              <LessonCalendar
                selectedDay={pageState.date}
                visibleMonth={visibleMonth}
                daySummaries={daySummaries}
                onSelectDay={handleSelectDay}
                onMonthChange={handleMonthChange}
              />
            </CardContent>
          </Card>
        </div>

        <div className="min-h-0">
          {isPending && !data ? (
            <DashboardContentSkeleton />
          ) : isError ? (
            <DashboardErrorState error={error} onRetry={() => void refetch()} />
          ) : data && data.summary.totalLessons === 0 ? (
            <DashboardEmptyMonth month={visibleMonth} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl tracking-tight sm:text-2xl">
                  {format(pageState.date, 'd MMMM', { locale: ru })}
                </CardTitle>
                <CardAction>
                  <FiltersDrawer ctrl={filters} />
                </CardAction>
              </CardHeader>
              <CardContent>
                {visibleLessons.length > 0 ? (
                  <LessonsTable lessons={visibleLessons} />
                ) : (
                  <DashboardEmptyDay selectedDay={pageState.date} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Точки под датами месяца — по видимым урокам, а не по серверной сводке дня:
 * иначе фильтр прятал бы уроки в списке, но не в календаре. Правило статуса то же,
 * что на сервере (`buildDayStatus`).
 */
function buildCalendarDaySummaryMap(
  data: DashboardMonthData | undefined,
  isLessonVisible: (lesson: DashboardLessonItem) => boolean,
): DashboardCalendarDaySummaryMap {
  if (!data) {
    return {}
  }

  return Object.fromEntries(
    data.days.map((day) => {
      const lessons = day.lessons.filter(isLessonVisible)
      const unmarkedAttendanceCount = lessons.reduce(
        (acc, lesson) => acc + lesson.summary.unmarkedAttendanceCount,
        0,
      )
      const attendanceToMarkCount = lessons.reduce(
        (acc, lesson) => acc + lesson.summary.attendanceToMarkCount,
        0,
      )

      return [
        day.date,
        {
          status:
            unmarkedAttendanceCount > 0
              ? ('unmarked' as const)
              : attendanceToMarkCount > 0
                ? ('marked' as const)
                : null,
          totalLessons: lessons.length,
          unmarkedAttendanceCount,
        },
      ]
    }),
  )
}

function DashboardEmptyMonth({ month }: { month: Date }) {
  return (
    <Card>
      <CardContent>
        <Empty className="bg-muted/20 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Calendar />
            </EmptyMedia>
            <EmptyTitle>На {toMonthLabel(month)} уроков нет</EmptyTitle>
            <EmptyDescription>
              Месячный снапшот загрузился успешно, но в выбранном месяце нет ни одного урока.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  )
}

function DashboardEmptyDay({ selectedDay }: { selectedDay: Date }) {
  return (
    <Empty className="bg-muted/20 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Clock />
        </EmptyMedia>
        <EmptyTitle>На {format(selectedDay, 'd MMMM', { locale: ru })} уроков нет</EmptyTitle>
        <EmptyDescription>
          Месяц уже загружен. Выберите другой день в календаре, чтобы увидеть расписание и
          посещаемость.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function DashboardErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : 'Не удалось загрузить dashboard'

  return (
    <Card className="min-h-72">
      <CardContent className="flex h-full items-center">
        <Empty className="border-destructive/20 bg-destructive/5 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleAlert />
            </EmptyMedia>
            <EmptyTitle>Ошибка загрузки</EmptyTitle>
            <EmptyDescription>{message}</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw />
            Попробовать снова
          </Button>
        </Empty>
      </CardContent>
    </Card>
  )
}

function LessonsTable({ lessons }: { lessons: DashboardLessonItem[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggle = (lessonId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(lessonId)) next.delete(lessonId)
      else next.add(lessonId)
      return next
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="w-6 px-2 py-2 font-medium"></th>
            <th className="px-2 py-2 font-medium">Время</th>
            <th className="px-2 py-2 font-medium">Курс</th>
            <th className="px-2 py-2 font-medium">Учителя</th>
            <th className="px-2 py-2 font-medium">Локация</th>
            <th className="px-2 py-2 text-center font-medium">Учеников</th>
            <th className="px-2 py-2 text-center font-medium">
              <span className="inline-flex items-center gap-1.5" title="Не отмеченные">
                Не отм.
              </span>
            </th>
            <th className="px-2 py-2 text-center font-medium">Статус</th>
            <th className="px-2 py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson) => {
            const isOpen = expanded.has(lesson.id)
            const isCancelled = lesson.status === 'CANCELLED'
            const hasAttendance = lesson.attendance.length > 0
            return (
              <Fragment key={lesson.id}>
                <tr
                  className={cn(
                    'border-b transition-colors',
                    hasAttendance && 'hover:bg-muted/50 cursor-pointer',
                  )}
                  onClick={hasAttendance ? () => toggle(lesson.id) : undefined}
                >
                  <td className="px-2 py-2">
                    {hasAttendance && (
                      <ChevronDown
                        className={cn('size-3.5 transition-transform', isOpen ? '' : '-rotate-90')}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono font-medium tabular-nums">{lesson.time}</td>
                  <td
                    className={cn(
                      'px-2 py-2 font-medium',
                      isCancelled && 'text-muted-foreground line-through',
                    )}
                  >
                    {lesson.group.course.name}
                  </td>
                  <td className="px-2 py-2">
                    {lesson.teachers.length === 0 ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      lesson.teachers.map((t, index) => (
                        <Fragment key={t.id}>
                          <Link
                            href={`/organization/members/${t.id}`}
                            className="text-primary hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {t.name}
                          </Link>
                          {index < lesson.teachers.length - 1 && ', '}
                        </Fragment>
                      ))
                    )}
                  </td>
                  <td className="text-muted-foreground px-2 py-2">
                    {lesson.group.location?.name ?? '-'}
                  </td>
                  <td className="px-2 py-2 text-center font-mono tabular-nums">
                    {lesson.attendance.length}
                  </td>
                  <td className="px-2 py-2 text-center font-mono tabular-nums">
                    {lesson.summary.attendanceToMarkCount === 0 ? (
                      <span className="text-muted-foreground">-</span>
                    ) : lesson.summary.unmarkedAttendanceCount === 0 ? (
                      <Check className="text-success inline size-3.5" />
                    ) : (
                      <span className="text-warning font-semibold">
                        {lesson.summary.unmarkedAttendanceCount}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {isCancelled ? (
                      <Badge variant="outline">Отменён</Badge>
                    ) : (
                      <Badge variant="success">Активен</Badge>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right" onClick={(event) => event.stopPropagation()}>
                    <LessonActions lesson={lesson} />
                  </td>
                </tr>
                {isOpen && hasAttendance && <LessonAttendanceRows lesson={lesson} />}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LessonActions({ lesson }: { lesson: DashboardLessonItem }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        <SquareArrowOutUpRight />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem render={<Link href={`/lessons/${lesson.id}`} />} nativeButton={false}>
          В урок
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<Link href={`/groups/${lesson.group.id}`} />}
          nativeButton={false}
        >
          В группу
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LessonAttendanceRows({ lesson }: { lesson: DashboardLessonItem }) {
  const isCancelled = lesson.status === 'CANCELLED'
  const commentMutation = useUpdateAttendanceCommentMutation(lesson.id)
  const { data: hasUpdatePermission } = useOrganizationPermissionQuery({
    studentLesson: ['update'],
  })
  const showActions = Boolean(hasUpdatePermission?.success) && !isCancelled

  const handleCommentChange = useMemo(
    () =>
      debounce((studentId: number, lessonId: number, comment: string) => {
        commentMutation.mutate({ studentId, lessonId, comment })
      }, 500),
    [commentMutation],
  )

  return (
    <>
      {lesson.attendance.map((attendance) => {
        const fullName = getFullName(attendance.student.firstName, attendance.student.lastName)
        const makeup = attendance.makeupForAttendance
          ? {
              href: `/lessons/${attendance.makeupForAttendance.lessonId}`,
              label: `Отработка за ${formatDateOnly(attendance.makeupForAttendance.lesson.date)}`,
            }
          : attendance.makeupAttendance
            ? {
                href: `/lessons/${attendance.makeupAttendance.lessonId}`,
                label: `Отработка ${formatDateOnly(attendance.makeupAttendance.lesson.date)}`,
              }
            : null

        return (
          <tr key={attendance.id} className="bg-muted/20 border-b last:border-b-0">
            <td colSpan={11} className="px-2 py-1.5 pl-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[0.6875rem]">
                  <Link
                    href={`/students/${attendance.student.id}`}
                    className="text-foreground hover:text-primary truncate hover:underline"
                  >
                    {fullName}
                  </Link>
                  {attendance.isTrial && (
                    <Badge className="bg-info/10 text-info h-4 shrink-0 px-1.5 text-[0.5625rem]">
                      Пробный
                    </Badge>
                  )}
                  {makeup && (
                    <Link
                      href={makeup.href}
                      className="text-primary shrink-0 truncate text-[0.625rem] hover:underline"
                    >
                      {makeup.label}
                    </Link>
                  )}
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <AttendanceStatusSwitcher attendance={attendance} disabled={isCancelled} />
                  {isCancelled ? (
                    <span className="text-muted-foreground w-56 truncate text-[0.625rem]">
                      {attendance.comment || '-'}
                    </span>
                  ) : (
                    <AttendanceCommentInput
                      studentId={attendance.studentId}
                      lessonId={attendance.lessonId}
                      initialValue={attendance.comment}
                      onChange={handleCommentChange}
                    />
                  )}

                  {showActions && <AttendanceActions attendance={attendance} />}
                </div>
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}

function AttendanceCommentInput({
  studentId,
  lessonId,
  initialValue,
  onChange,
}: {
  studentId: number
  lessonId: number
  initialValue: string
  onChange: (studentId: number, lessonId: number, comment: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <Input
      value={value}
      onChange={(event) => {
        setValue(event.target.value)
        onChange(studentId, lessonId, event.target.value)
      }}
      placeholder="Комментарий"
      className="h-7 w-56"
    />
  )
}

function DashboardContentSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}
