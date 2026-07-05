'use client'

import { Hint } from '@/src/components/hint'
import { StatCard } from '@/src/components/stat-card'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/src/components/ui/empty'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import AttendanceActions from '@/src/features/lessons/components/attendance-actions'
import { AttendanceStatusSwitcher } from '@/src/features/lessons/components/attendance-status-switcher'
import { useUpdateAttendanceCommentMutation } from '@/src/features/lessons/queries'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { formatDateOnly, moscowNow } from '@/src/lib/timezone'
import { cn, getFullName } from '@/src/lib/utils'
import { format, isSameDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { debounce } from 'es-toolkit'
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Clock,
  Info,
  RefreshCw,
  SquareArrowOutUpRight,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { createParser, useQueryStates } from 'nuqs'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useDashboardMonthQuery } from '../queries'
import { DASHBOARD_MONTH_KEY_REGEX } from '../schemas'
import type {
  DashboardCalendarDaySummaryMap,
  DashboardDayData,
  DashboardDayStatus,
  DashboardLessonItem,
  DashboardMonthData,
} from '../types'
import { CalendarPromoBanner } from './calendar-promo-banner'
import { LessonCalendar } from './lesson-calendar'

const QUERY_STATE_OPTIONS = { shallow: true, history: 'push' as const }

function getMoscowToday() {
  const today = moscowNow()
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

function toWeekdayLabel(date: Date) {
  const label = format(date, 'EEEE', { locale: ru })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function getMarkedRatio(marked: number, total: number) {
  if (total === 0) {
    return '0'
  }

  return `${marked} / ${total}`
}

const today = getMoscowToday()
const DEFAULT_MONTH_KEY = getMonthKey(today)

const localDateParser = createParser({
  parse: parseLocalDate,
  serialize: serializeLocalDate,
})

const monthKeyParser = createParser({
  parse: (value: string) => (DASHBOARD_MONTH_KEY_REGEX.test(value) ? value : null),
  serialize: (value: string) => value,
})

const dayStatusConfig: Record<
  Exclude<DashboardDayStatus, null>,
  { label: string; className: string; hint: string }
> = {
  marked: {
    label: 'Все отмечены',
    className: 'bg-success/10 text-success hover:bg-success/15 cursor-help',
    hint: 'Во всех активных уроках на этот день посещаемость уже проставлена.',
  },
  unmarked: {
    label: 'Есть неотмеченные',
    className: 'bg-destructive/10 text-destructive hover:bg-destructive/15 cursor-help',
    hint: 'Хотя бы в одном активном уроке остались ученики со статусом "Не отмечен".',
  },
}

export default function Dashboard() {
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
  const daySummaries = buildCalendarDaySummaryMap(data)
  const isToday = data ? selectedDayKey === data.today : isSameDay(pageState.date, today)

  const handleSelectDay = (day: Date) => {
    void setPageState({ date: day })
  }

  const handleMonthChange = (month: Date) => {
    void setPageState({
      month: getMonthKey(month),
      date: clampDateToMonth(pageState.date, month),
    })
  }

  const handleSelectToday = () => {
    const nextToday = getMoscowToday()

    void setPageState({
      month: getMonthKey(nextToday),
      date: nextToday,
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <CalendarPromoBanner />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <Card className={cn(isFetching && data && 'opacity-80')}>
            <CardHeader>
              <div>
                <CardTitle>
                  <div className="flex gap-1">
                    <span>Календарь месяца</span>
                    <Tooltip>
                      <TooltipTrigger
                        delay={300}
                        render={
                          <Button type="button" size="icon-sm" variant="ghost">
                            <CircleHelp aria-hidden />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <div className="grid sm:grid-cols-3 xl:grid-cols-1">
                          <LegendItem
                            colorClassName="bg-success"
                            text="Все активные посещения отмечены"
                          />
                          <LegendItem
                            colorClassName="bg-destructive"
                            text="Есть неотмеченные ученики"
                          />
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardTitle>
              </div>
              <CardAction>
                <Button
                  variant="outline"
                  onClick={handleSelectToday}
                  disabled={
                    pageState.month === DEFAULT_MONTH_KEY && isSameDay(pageState.date, today)
                  }
                >
                  <Calendar />
                  Сегодня
                </Button>
              </CardAction>
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

          {isPending && !data ? (
            <MonthOverviewSkeleton />
          ) : (
            <MonthOverviewCard data={data} isFetching={isFetching} />
          )}
        </div>

        <div className="min-h-0 space-y-2">
          {isPending && !data ? (
            <DashboardContentSkeleton />
          ) : isError ? (
            <DashboardErrorState error={error} onRetry={() => void refetch()} />
          ) : data && data.summary.totalLessons === 0 ? (
            <DashboardEmptyMonth month={visibleMonth} />
          ) : (
            <>
              <SelectedDayHeader
                selectedDay={pageState.date}
                dayData={selectedDayData}
                isToday={isToday}
              />

              {selectedDayData ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      Расписание дня
                      <Hint text="Нажмите на строку урока, чтобы увидеть список учеников и их статусы посещаемости." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LessonsTable lessons={selectedDayData.lessons} />
                  </CardContent>
                </Card>
              ) : (
                <DashboardEmptyDay selectedDay={pageState.date} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function buildCalendarDaySummaryMap(
  data: DashboardMonthData | undefined,
): DashboardCalendarDaySummaryMap {
  if (!data) {
    return {}
  }

  return Object.fromEntries(
    data.days.map((day) => [
      day.date,
      {
        status: day.status,
        totalLessons: day.summary.totalLessons,
        unmarkedAttendanceCount: day.summary.unmarkedAttendanceCount,
      },
    ]),
  )
}

function LegendItem({ colorClassName, text }: { colorClassName: string; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg">
      <span className={cn('size-2 rounded-full', colorClassName)} />
      <span className="text-xs/relaxed">{text}</span>
    </div>
  )
}

function MonthOverviewCard({
  data,
  isFetching,
}: {
  data: DashboardMonthData | undefined
  isFetching: boolean
}) {
  const summary = data?.summary

  return (
    <Card className={cn(isFetching && summary && 'opacity-80')}>
      <CardHeader>
        <div>
          <CardTitle>Обзор месяца</CardTitle>
          <CardDescription>Ключевые сигналы по выбранному месяцу и текущему дню.</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Всего уроков"
            value={summary?.totalLessons ?? '-'}
            icon={BookOpen}
            hint="Во всех днях выбранного месяца"
          />
          <StatCard
            label="Дни с риском"
            value={summary?.unmarkedDays ?? '-'}
            icon={CircleAlert}
            variant={summary && summary.unmarkedDays > 0 ? 'danger' : 'default'}
            hint="Дни, где есть хотя бы один неотмеченный ученик"
          />
          <StatCard label="Сегодня" value={summary?.todayLessons ?? '-'} icon={Calendar} />
          <StatCard
            label="Отмены"
            value={summary?.cancelledLessons ?? '-'}
            icon={XCircle}
            variant={summary && summary.cancelledLessons > 0 ? 'warning' : 'default'}
            hint="Отменённые уроки всё ещё видны в календаре"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function SelectedDayHeader({
  selectedDay,
  dayData,
  isToday,
}: {
  selectedDay: Date
  dayData: DashboardDayData | null
  isToday: boolean
}) {
  const statusMeta = dayData?.status ? dayStatusConfig[dayData.status] : null
  const summary = dayData?.summary ?? {
    totalLessons: 0,
    activeLessons: 0,
    cancelledLessons: 0,
    attendanceCount: 0,
    attendanceToMarkCount: 0,
    markedAttendanceCount: 0,
    unmarkedAttendanceCount: 0,
    presentCount: 0,
    absentCount: 0,
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{toWeekdayLabel(selectedDay)}</Badge>
            {statusMeta ? (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Badge className={statusMeta.className}>
                        {statusMeta.label}
                        <Info />
                      </Badge>
                    }
                  />
                  <TooltipContent>{statusMeta.hint}</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Badge variant="outline">Без статуса</Badge>
            )}
            {isToday && <Badge variant="secondary">Сегодня</Badge>}
          </div>

          <div>
            <CardTitle className="text-xl tracking-tight sm:text-2xl">
              {format(selectedDay, 'd MMMM', { locale: ru })}
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-2 sm:grid-cols-4">
          <SummaryTile label="Уроки" value={summary.totalLessons} />
          <SummaryTile
            label="Отмечено"
            value={getMarkedRatio(summary.markedAttendanceCount, summary.attendanceToMarkCount)}
          />
          <SummaryTile label="Не отмечены" value={summary.unmarkedAttendanceCount} />
          <SummaryTile label="Отмены" value={summary.cancelledLessons} />
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryTile({
  label,
  value,
  description,
}: {
  label: string
  value: React.ReactNode
  description?: string
}) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2">
      <div className="text-muted-foreground text-[0.6875rem] tracking-[0.12em] uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tracking-tight">{value}</div>
      {description && (
        <div className="text-muted-foreground mt-1 text-[0.6875rem] leading-tight">
          {description}
        </div>
      )}
    </div>
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
    <Card>
      <CardContent>
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
      </CardContent>
    </Card>
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

function MonthOverviewSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Обзор месяца</CardTitle>
          <CardDescription>Подгружаем основные показатели...</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
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
    <div className="space-y-2">
      <Card>
        <CardContent className="space-y-2 py-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-10 w-56" />
          <div className="grid gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-18 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-2 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="grid gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((__, tileIndex) => (
                <Skeleton key={tileIndex} className="h-18 rounded-lg" />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((__, badgeIndex) => (
                <Skeleton key={badgeIndex} className="h-7 w-28 rounded-xl" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
