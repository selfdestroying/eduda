'use client'

import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Calendar } from '@/src/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/src/components/ui/empty'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import {
  useMySalaryDataQuery,
  useMySalaryPaychecksQuery,
} from '@/src/features/finances/salaries/queries'
import type { LessonWithPrice, SalaryFilters } from '@/src/features/finances/salaries/types'
import { MyIncomeChart } from '@/src/features/users/me/components/my-income-chart'
import { dateToYmd, moscowNow, moscowStartOfDay, ymdToLocalDate } from '@/src/lib/timezone'
import { cn, getGroupName } from '@/src/lib/utils'
import { cva } from 'class-variance-authority'
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  BookOpen,
  Calendar as CalendarIcon,
  CalendarSearch,
  ChevronDown,
  Clock,
  FileText,
  MapPin,
  Receipt,
  Scale,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { type DateRange } from 'react-day-picker'

const datePresets = [
  {
    label: 'Текущая неделя',
    getValue: () => ({
      from: startOfWeek(moscowNow(), { weekStartsOn: 1 }),
      to: moscowStartOfDay(),
    }),
  },
  {
    label: 'Прошлая неделя',
    getValue: () => ({
      from: startOfWeek(subWeeks(moscowNow(), 1), { weekStartsOn: 1 }),
      to: endOfWeek(subWeeks(moscowNow(), 1), { weekStartsOn: 1 }),
    }),
  },
  {
    label: 'Текущий месяц',
    getValue: () => ({
      from: startOfMonth(moscowNow()),
      to: endOfMonth(moscowNow()),
    }),
  },
  {
    label: 'Прошлый месяц',
    getValue: () => ({
      from: startOfMonth(subMonths(moscowNow(), 1)),
      to: endOfMonth(subMonths(moscowNow(), 1)),
    }),
  },
  {
    label: 'Текущий год',
    getValue: () => ({
      from: startOfYear(moscowNow()),
      to: endOfYear(moscowNow()),
    }),
  },
  {
    label: 'Прошлый год',
    getValue: () => ({
      from: startOfYear(subMonths(moscowNow(), 12)),
      to: endOfYear(subMonths(moscowNow(), 12)),
    }),
  },
]

const lessonStatusMap = {
  ACTIVE: 'Активен',
  CANCELLED: 'Отменен',
} as const

const lessonStatusVariants = cva('', {
  variants: {
    status: {
      ACTIVE: ['bg-success/10', 'text-success'],
      CANCELLED: ['bg-destructive/10', 'text-destructive'],
    },
  },
})

export default function MySalary() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const filters: SalaryFilters | null = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null
    return {
      startDate: dateToYmd(dateRange.from),
      endDate: dateToYmd(dateRange.to),
    }
  }, [dateRange])

  const { data: salaryData, isPending, isError, error } = useMySalaryDataQuery(filters)
  const { data: paychecks = [] } = useMySalaryPaychecksQuery(
    filters?.startDate ?? null,
    filters?.endDate ?? null,
  )

  const myData = salaryData?.teachers[0]
  const lessons = useMemo(() => myData?.lessons ?? [], [myData])

  const stats = useMemo(() => {
    const activeLessons = lessons.filter((l) => l.status === 'ACTIVE')
    const cancelledLessons = lessons.filter((l) => l.status === 'CANCELLED')
    const lessonsTotal = activeLessons.reduce((sum, l) => sum + l.price, 0)
    const totalStudents = activeLessons.reduce((sum, l) => sum + l.presentCount, 0)
    const paychecksTotal = paychecks.reduce((sum, p) => sum + p.amount, 0)
    return {
      activeCount: activeLessons.length,
      cancelledCount: cancelledLessons.length,
      lessonsTotal,
      totalStudents,
      paychecksTotal,
      grandTotal: lessonsTotal + paychecksTotal,
    }
  }, [lessons, paychecks])

  const lessonsByDate = useMemo(() => {
    const grouped: Record<string, LessonWithPrice[]> = {}
    for (const lesson of lessons) {
      const dateKey = new Date(lesson.date).toISOString().split('T')[0]!
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey]!.push(lesson)
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [lessons])

  const handlePresetSelect = (preset: (typeof datePresets)[0]) => {
    setDateRange(preset.getValue())
    setIsCalendarOpen(false)
  }

  const activePresetLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null
    for (const p of datePresets) {
      const v = p.getValue()
      if (
        v.from.getTime() === dateRange.from.getTime() &&
        v.to.getTime() === dateRange.to.getTime()
      ) {
        return p.label
      }
    }
    return null
  }, [dateRange])

  const formatDateRange = () => {
    if (!dateRange?.from) return 'Выберите период'
    if (!dateRange.to) return format(dateRange.from, 'd MMM yyyy', { locale: ru })
    return `${format(dateRange.from, 'd MMM', { locale: ru })} - ${format(dateRange.to, 'd MMM yyyy', { locale: ru })}`
  }

  return (
    <div className="space-y-2">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="min-w-50 justify-start gap-2">
                    <CalendarIcon />
                    <span className="truncate">{formatDateRange()}</span>
                    <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={ru}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <div className="flex flex-wrap items-center gap-1">
              {datePresets.map((preset) => {
                const isActive = activePresetLabel === preset.label
                return (
                  <Button
                    key={preset.label}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </Button>
                )
              })}
            </div>

            {dateRange && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => setDateRange(undefined)}
              >
                <X />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center lg:gap-5">
            <StatItem
              icon={<BookOpen className="h-4 w-4" />}
              label="Уроки"
              value={
                <span className="flex items-baseline gap-1">
                  {stats.activeCount}
                  {stats.cancelledCount > 0 && (
                    <span className="text-muted-foreground text-xs">
                      +{stats.cancelledCount} отм.
                    </span>
                  )}
                </span>
              }
            />
            <StatItem
              icon={<Users className="h-4 w-4" />}
              label="Учеников"
              value={stats.totalStudents}
            />
            <StatItem
              icon={<TrendingUp className="text-success h-4 w-4" />}
              label="За уроки"
              value={`${stats.lessonsTotal.toLocaleString()} ₽`}
            />
            <StatItem
              icon={<Receipt className="text-success h-4 w-4" />}
              label="Доп. доход"
              value={`${stats.paychecksTotal.toLocaleString()} ₽`}
            />
            <StatItem
              icon={<Scale className="text-success h-4 w-4" />}
              label="Итого"
              value={<span className="text-success">{stats.grandTotal.toLocaleString()} ₽</span>}
            />
          </div>
        </CardContent>
      </Card>

      <MyIncomeChart
        selectedRange={dateRange ? { from: dateRange.from, to: dateRange.to } : undefined}
        onSelectPeriod={(range) => setDateRange({ from: range.from, to: range.to })}
      />

      {!dateRange?.from || !dateRange?.to ? (
        <Empty className="bg-card ring-foreground/10 h-full ring-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarSearch />
            </EmptyMedia>
            <EmptyTitle>Период не выбран</EmptyTitle>
            <EmptyDescription>
              Укажите диапазон дат, чтобы увидеть свои уроки и зарплату
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : isError ? (
        <Empty className="bg-card ring-destructive/20 h-full ring-1">
          <EmptyHeader>
            <EmptyTitle>Ошибка загрузки</EmptyTitle>
            <EmptyDescription>
              {error instanceof Error ? error.message : 'Не удалось загрузить данные'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : isPending ? (
        <div className="grid gap-2 lg:grid-cols-2">
          <Card>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {lessons.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4" />
                  Уроки
                  <span className="text-muted-foreground text-sm font-normal">
                    ({lessons.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lessonsByDate.map(([dateKey, dateLessons]) => {
                  const dayTotal = dateLessons
                    .filter((l) => l.status === 'ACTIVE')
                    .reduce((sum, l) => sum + l.price, 0)
                  return (
                    <div key={dateKey}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                          <CalendarIcon className="h-3 w-3" />
                          {format(ymdToLocalDate(dateKey), 'd MMMM, EEEE', { locale: ru })}
                        </div>
                        {dayTotal > 0 && (
                          <span className="text-muted-foreground text-xs">
                            {dayTotal.toLocaleString()} ₽
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {dateLessons.map((lesson) => (
                          <LessonItem key={lesson.id} lesson={lesson} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="text-muted-foreground mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-medium">Нет уроков</h3>
                <p className="text-muted-foreground text-center text-sm">
                  За выбранный период уроки не найдены.
                </p>
              </CardContent>
            </Card>
          )}
          {paychecks.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4" />
                  Доп. доход
                  <span className="text-muted-foreground text-sm font-normal">
                    ({paychecks.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {paychecks.map((paycheck) => (
                  <PaycheckItem key={paycheck.id} paycheck={paycheck} />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="text-muted-foreground mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-medium">Нет доп. дохода</h3>
                <p className="text-muted-foreground text-center text-sm">
                  За выбранный период доп. доход не найден.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <div className="flex flex-col leading-tight">
        <span className="text-muted-foreground text-[11px]">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
    </div>
  )
}

function PaycheckItem({
  paycheck,
}: {
  paycheck: { id: number; date: string; amount: number; comment: string | null }
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Receipt className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-sm font-medium">{paycheck.comment || 'Доп. доход'}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 pl-5.5 text-xs">
          {format(ymdToLocalDate(paycheck.date), 'd MMM yyyy', { locale: ru })}
        </div>
      </div>
      <span className="text-success text-sm font-semibold whitespace-nowrap">
        {paycheck.amount.toLocaleString()} ₽
      </span>
    </div>
  )
}

function LessonItem({ lesson }: { lesson: LessonWithPrice }) {
  const isCancelled = lesson.status === 'CANCELLED'
  const hasBonus = lesson.bonusPerStudent > 0 && lesson.presentCount > 0

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors',
        isCancelled && 'bg-muted/40 opacity-75',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/lessons/${lesson.id}`}
            className={cn(
              'text-primary truncate text-sm font-medium hover:underline',
              isCancelled && 'line-through',
            )}
          >
            {getGroupName(lesson.group)}
          </Link>
          {isCancelled && (
            <Badge
              className={cn(
                'h-5 shrink-0 px-1.5 text-[10px]',
                lessonStatusVariants({ status: lesson.status }),
              )}
            >
              {lessonStatusMap[lesson.status]}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
          {lesson.time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lesson.time}
            </span>
          )}
          {lesson.group.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {lesson.group.location.name}
            </span>
          )}
          {hasBonus && (
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {lesson.presentCount} уч.
              </TooltipTrigger>
              <TooltipContent>
                {lesson.price - lesson.bonusPerStudent * lesson.presentCount} ₽ ставка +{' '}
                {lesson.bonusPerStudent} ₽ × {lesson.presentCount} уч. = {lesson.price} ₽
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <span
        className={cn('text-sm font-semibold whitespace-nowrap', isCancelled && 'line-through')}
      >
        {lesson.price.toLocaleString()} ₽
      </span>
    </div>
  )
}
