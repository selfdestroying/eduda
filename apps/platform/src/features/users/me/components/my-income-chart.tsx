'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/src/components/ui/chart'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { useMyIncomeHistoryQuery } from '@/src/features/users/me/queries'
import { cn } from '@/src/lib/utils'
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceArea, XAxis, YAxis } from 'recharts'

type Granularity = 'year' | 'month' | 'week' | 'day'

const chartConfig = {
  lessons: { label: 'За уроки', color: 'var(--chart-1)' },
  paychecks: { label: 'Доп. доход', color: 'var(--chart-2)' },
  total: { label: 'Итого', color: 'var(--chart-3)' },
} satisfies ChartConfig

const granularityLabel: Record<Granularity, string> = {
  year: 'Год',
  month: 'Месяц',
  week: 'Неделя',
  day: 'День',
}

interface BucketEntry {
  bucketKey: string
  bucketDate: Date
  label: string
  fullLabel: string
  lessons: number
  paychecks: number
  total: number
}

function bucketize(
  entries: { date: string; lessons: number; paychecks: number }[],
  granularity: Granularity,
): BucketEntry[] {
  const buckets = new Map<string, BucketEntry>()

  for (const e of entries) {
    const d = parseISO(e.date)
    let bucketDate: Date
    let bucketKey: string
    let label: string
    let fullLabel: string

    switch (granularity) {
      case 'year':
        bucketDate = startOfYear(d)
        bucketKey = String(bucketDate.getFullYear())
        label = bucketKey
        fullLabel = bucketKey
        break
      case 'month':
        bucketDate = startOfMonth(d)
        bucketKey = format(bucketDate, 'yyyy-MM')
        label = format(bucketDate, 'LLL yy', { locale: ru })
        fullLabel = format(bucketDate, 'LLLL yyyy', { locale: ru })
        break
      case 'week': {
        bucketDate = startOfWeek(d, { weekStartsOn: 1 })
        bucketKey = format(bucketDate, 'yyyy-MM-dd')
        const end = endOfWeek(d, { weekStartsOn: 1 })
        label = format(bucketDate, 'd MMM', { locale: ru })
        fullLabel = `${format(bucketDate, 'd MMM', { locale: ru })} – ${format(end, 'd MMM yyyy', { locale: ru })}`
        break
      }
      case 'day':
        bucketDate = startOfDay(d)
        bucketKey = format(bucketDate, 'yyyy-MM-dd')
        label = format(bucketDate, 'd MMM', { locale: ru })
        fullLabel = format(bucketDate, 'd MMMM yyyy', { locale: ru })
        break
    }

    const existing = buckets.get(bucketKey)
    if (existing) {
      existing.lessons += e.lessons
      existing.paychecks += e.paychecks
      existing.total = existing.lessons + existing.paychecks
    } else {
      buckets.set(bucketKey, {
        bucketKey,
        bucketDate,
        label,
        fullLabel,
        lessons: e.lessons,
        paychecks: e.paychecks,
        total: e.lessons + e.paychecks,
      })
    }
  }

  return Array.from(buckets.values()).sort(
    (a, b) => a.bucketDate.getTime() - b.bucketDate.getTime(),
  )
}

function formatCompactRub(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function IncomeTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: BucketEntry }>
}) {
  if (!active || !payload?.length) return null
  const b = payload[0]?.payload
  if (!b) return null
  return (
    <div className="bg-popover text-popover-foreground min-w-48 rounded-lg border p-2.5 text-xs shadow-md">
      <div className="mb-1.5 border-b pb-1.5 font-semibold">{b.fullLabel}</div>
      <div className="space-y-1">
        <Row color={chartConfig.lessons.color} label="За уроки" value={b.lessons} />
        {b.paychecks > 0 && (
          <Row color={chartConfig.paychecks.color} label="Доп. доход" value={b.paychecks} />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between border-t pt-1.5 font-semibold">
        <span>Итого</span>
        <span className="font-mono tabular-nums">{b.total.toLocaleString('ru-RU')} ₽</span>
      </div>
    </div>
  )
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
        <span className="text-muted-foreground">{label}</span>
      </span>
      <span className="font-mono tabular-nums">{value.toLocaleString('ru-RU')} ₽</span>
    </div>
  )
}

function bucketRange(bucketDate: Date, granularity: Granularity): { from: Date; to: Date } {
  switch (granularity) {
    case 'year':
      return { from: startOfYear(bucketDate), to: endOfYear(bucketDate) }
    case 'month':
      return { from: startOfMonth(bucketDate), to: endOfMonth(bucketDate) }
    case 'week':
      return {
        from: startOfWeek(bucketDate, { weekStartsOn: 1 }),
        to: endOfWeek(bucketDate, { weekStartsOn: 1 }),
      }
    case 'day':
      return { from: startOfDay(bucketDate), to: endOfDay(bucketDate) }
  }
}

export interface MyIncomeChartProps {
  onSelectPeriod?: (range: { from: Date; to: Date }) => void
  selectedRange?: { from?: Date; to?: Date }
}

export function MyIncomeChart({ onSelectPeriod, selectedRange }: MyIncomeChartProps = {}) {
  const [granularity, setGranularity] = useState<Granularity>('week')
  const { data: entries = [], isPending, isError } = useMyIncomeHistoryQuery()

  const buckets = useMemo(() => bucketize(entries, granularity), [entries, granularity])

  const highlightedKeys = useMemo(() => {
    if (!selectedRange?.from || !selectedRange?.to) return new Set<string>()
    const from = startOfDay(selectedRange.from).getTime()
    const to = startOfDay(selectedRange.to).getTime()
    const set = new Set<string>()
    for (const b of buckets) {
      const bRange = bucketRange(b.bucketDate, granularity)
      const bStart = startOfDay(bRange.from).getTime()
      const bEnd = startOfDay(bRange.to).getTime()
      if (bStart <= to && bEnd >= from) set.add(b.bucketKey)
    }
    return set
  }, [buckets, granularity, selectedRange])

  const highlightBounds = useMemo(() => {
    if (highlightedKeys.size === 0) return null
    const matching = buckets.filter((b) => highlightedKeys.has(b.bucketKey))
    if (matching.length === 0) return null
    return { x1: matching[0]!.label, x2: matching[matching.length - 1]!.label }
  }, [buckets, highlightedKeys])

  const summary = useMemo(() => {
    if (buckets.length === 0) return null
    const totalAll = buckets.reduce((s, b) => s + b.total, 0)
    const avg = Math.round(totalAll / buckets.length)
    const max = buckets.reduce((m, b) => (b.total > m.total ? b : m), buckets[0]!)
    const last = buckets[buckets.length - 1]!
    const prev = buckets.length > 1 ? buckets[buckets.length - 2]! : null
    const delta =
      prev && prev.total > 0 ? Math.round(((last.total - prev.total) / prev.total) * 100) : null
    return { totalAll, avg, max, last, delta }
  }, [buckets])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Динамика дохода
        </CardTitle>
        <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <TabsList className="h-8">
            {(Object.keys(granularityLabel) as Granularity[]).map((g) => (
              <TabsTrigger key={g} value={g} className="text-xs">
                {granularityLabel[g]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <div className="text-destructive py-8 text-center text-sm">
            Не удалось загрузить историю дохода
          </div>
        ) : buckets.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            Пока нет данных о доходе
          </div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCell
                  label="Всего за всё время"
                  value={`${summary.totalAll.toLocaleString('ru-RU')} ₽`}
                />
                <SummaryCell
                  label={`Средн. за ${granularityLabel[granularity].toLowerCase()}`}
                  value={`${summary.avg.toLocaleString('ru-RU')} ₽`}
                />
                <SummaryCell
                  label="Лучший период"
                  value={`${summary.max.total.toLocaleString('ru-RU')} ₽`}
                  hint={summary.max.fullLabel}
                />
                <SummaryCell
                  label={summary.last.fullLabel}
                  value={`${summary.last.total.toLocaleString('ru-RU')} ₽`}
                  hint={
                    summary.delta !== null
                      ? `${summary.delta > 0 ? '+' : ''}${summary.delta}% к пред.`
                      : undefined
                  }
                  hintColor={
                    summary.delta === null
                      ? undefined
                      : summary.delta > 0
                        ? 'text-success'
                        : summary.delta < 0
                          ? 'text-destructive'
                          : undefined
                  }
                />
              </div>
            )}

            {onSelectPeriod && (
              <p className="text-muted-foreground text-xs">
                Нажмите на точку на графике, чтобы выбрать соответствующий период
              </p>
            )}
            <ChartContainer
              config={chartConfig}
              className={cn(
                'h-64 w-full',
                onSelectPeriod && '[&_.recharts-wrapper]:cursor-pointer',
              )}
            >
              <AreaChart
                data={buckets}
                margin={{ top: 8, right: 16, bottom: 0 }}
                onClick={(state) => {
                  if (!onSelectPeriod) return
                  const payload = state?.activePayload?.[0]?.payload as BucketEntry | undefined
                  if (!payload) return
                  onSelectPeriod(bucketRange(payload.bucketDate, granularity))
                }}
              >
                <defs>
                  <linearGradient id="fillLessons" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-lessons)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-lessons)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillPaychecks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-paychecks)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-paychecks)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  tickMargin={4}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => formatCompactRub(v)}
                  width={48}
                />
                <ChartTooltip cursor={{ fillOpacity: 0.05 }} content={<IncomeTooltip />} />
                {highlightBounds && (
                  <ReferenceArea
                    x1={highlightBounds.x1}
                    x2={highlightBounds.x2}
                    fill="var(--primary)"
                    fillOpacity={0.08}
                    stroke="var(--primary)"
                    strokeOpacity={0.4}
                    strokeDasharray="3 3"
                    ifOverflow="visible"
                  />
                )}
                <Area
                  dataKey="total"
                  stackId="income"
                  type="monotone"
                  stroke="var(--color-total)"
                  strokeWidth={2}
                  fill="url(#fillTotal)"
                />
              </AreaChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryCell({
  label,
  value,
  hint,
  hintColor,
}: {
  label: string
  value: string
  hint?: string
  hintColor?: string
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground truncate text-[11px]" title={label}>
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
      {hint && (
        <div className={`mt-0.5 truncate text-[11px] ${hintColor ?? 'text-muted-foreground'}`}>
          {hint}
        </div>
      )}
    </div>
  )
}
