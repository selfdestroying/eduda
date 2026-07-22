'use client'

import { Hint } from '@/src/components/hint'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/src/components/ui/chart'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useDismissedStatisticsQuery } from '@/src/features/statistics/queries'
import { GraduationCap, Percent, TrendingDown, TrendingUp, UserMinus } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

type NameCount = { name: string; count: number }

const trendConfig = {
  count: { label: 'Отчислено', color: 'var(--destructive)' },
} satisfies ChartConfig

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  hint,
  variant = 'default',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: { value: number; label: string; inverse?: boolean }
  hint?: string
  variant?: 'default' | 'destructive'
}) {
  const iconColor = variant === 'destructive' ? 'text-red-500' : 'text-muted-foreground'
  const bgColor = variant === 'destructive' ? 'bg-red-500/10' : 'bg-muted'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-1">
            <p className="text-muted-foreground flex items-center gap-0.5 text-xs font-medium">
              {title}
              {hint && <Hint text={hint} />}
            </p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <div className="flex items-center gap-1">
                {(trend.inverse ? trend.value <= 0 : trend.value >= 0) ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${(trend.inverse ? trend.value <= 0 : trend.value >= 0) ? 'text-emerald-500' : 'text-red-500'}`}
                >
                  {trend.value > 0 ? '+' : ''}
                  {trend.value}
                </span>
                <span className="text-muted-foreground text-xs">{trend.label}</span>
              </div>
            )}
            {subtitle && !trend && <p className="text-muted-foreground text-xs">{subtitle}</p>}
          </div>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bgColor}`}
          >
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CompactBarList({
  data,
  title,
  color,
}: {
  data: NameCount[]
  title: string
  color: string
}) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">{title}</p>
      <div className="space-y-1.5">
        {data.slice(0, 5).map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="w-24 truncate text-xs font-medium" title={item.name}>
              {item.name}
            </span>
            <div className="bg-muted relative h-5 flex-1 overflow-hidden rounded">
              <div
                className="absolute inset-y-0 left-0 rounded transition-all"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  backgroundColor: color,
                  opacity: 0.8,
                }}
              />
              <span className="relative z-10 flex h-full items-center px-2 text-xs font-medium">
                {item.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DismissedStatistics() {
  const { data: stats, isLoading, isError } = useDismissedStatisticsQuery()

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError || !stats) return <div className="text-destructive">Ошибка загрузки статистики</div>

  const {
    totalDismissed,
    churnRate,
    thisMonthCount,
    prevMonthCount,
    topCourseName,
    topCourseCount,
    monthly,
    teachers,
    courses,
    locations,
  } = stats
  const monthDelta = thisMonthCount - prevMonthCount

  return (
    <div className="space-y-2">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiCard
          title="Всего отчислено"
          value={totalDismissed}
          icon={UserMinus}
          variant="destructive"
          subtitle="за всё время"
        />
        <KpiCard
          title="Churn rate"
          value={`${churnRate}%`}
          icon={Percent}
          variant="destructive"
          subtitle="от всех учеников"
          hint="Процент оттока - доля отчисленных учеников от общего числа всех учеников (активных + отчисленных). Чем ниже, тем лучше."
        />
        <KpiCard
          title="В этом месяце"
          value={thisMonthCount}
          icon={TrendingDown}
          trend={
            prevMonthCount > 0
              ? { value: monthDelta, label: 'vs прошлый', inverse: true }
              : undefined
          }
          subtitle={prevMonthCount === 0 ? 'нет данных за прошлый месяц' : undefined}
          hint="Количество отчислений за текущий месяц. Стрелка показывает изменение по сравнению с прошлым месяцем."
        />
        <KpiCard
          title="Самый частый курс"
          value={topCourseName}
          icon={GraduationCap}
          subtitle={`${topCourseCount} отчислений`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-2 lg:grid-cols-5">
        {/* Trend + Teacher churn */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Отток по месяцам</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ChartContainer config={trendConfig} className="h-40 w-full">
              <AreaChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="dismissedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  tickMargin={4}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="count"
                  type="monotone"
                  fill="url(#dismissedGrad)"
                  stroke="var(--destructive)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Teacher churn + distributions */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Распределение оттока (Топ-5)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Teacher churn with percentage */}
              <div className="space-y-2">
                <p className="text-muted-foreground flex items-center gap-0.5 text-xs font-medium">
                  По преподавателям (% оттока)
                  <Hint text="Процент оттока по преподавателю = количество отчислений / общее количество учеников у этого преподавателя." />
                </p>
                <div className="space-y-1.5">
                  {teachers.slice(0, 5).map((t) => (
                    <div key={t.teacherName} className="flex items-center gap-2">
                      <span className="w-20 truncate text-xs font-medium" title={t.teacherName}>
                        {t.teacherName.split(' ')[0]}
                      </span>
                      <div className="bg-muted relative h-5 flex-1 overflow-hidden rounded">
                        <div
                          className="absolute inset-y-0 left-0 rounded bg-red-500/80 transition-all"
                          style={{
                            width: `${Math.min(t.percentage, 100)}%`,
                          }}
                        />
                        <span className="relative z-10 flex h-full items-center px-2 text-xs font-medium">
                          {t.percentage}%
                        </span>
                      </div>
                      <span className="text-muted-foreground w-8 text-right text-xs">
                        {t.dismissedCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <CompactBarList data={courses} title="По курсам" color="var(--chart-2)" />
              <CompactBarList data={locations} title="По локациям" color="var(--chart-4)" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
