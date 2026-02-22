'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/src/components/ui/chart'
import { GraduationCap, Layers, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

type ChartDataKeyCount = { name: string; count: number }
type MonthlyData = { month: string; count: number }

type ActiveStatisticsProps = {
  totalStudents: number
  newThisMonth: number
  newPrevMonth: number
  growthPercent: number
  totalGroups: number
  avgPerGroup: number
  monthly: MonthlyData[]
  locations: ChartDataKeyCount[]
  teachers: ChartDataKeyCount[]
  courses: ChartDataKeyCount[]
}

const trendConfig = {
  count: { label: 'Ученики', color: 'var(--chart-1)' },
} satisfies ChartConfig

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: { value: number; label: string }
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-1">
            <p className="text-muted-foreground text-xs font-medium">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <div className="flex items-center gap-1">
                {trend.value >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                >
                  {trend.value > 0 ? '+' : ''}
                  {trend.value}%
                </span>
                <span className="text-muted-foreground text-xs">{trend.label}</span>
              </div>
            )}
            {subtitle && !trend && <p className="text-muted-foreground text-xs">{subtitle}</p>}
          </div>
          <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="text-muted-foreground h-4 w-4" />
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
  data: ChartDataKeyCount[]
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

export default function ActiveStatistics({
  totalStudents,
  newThisMonth,
  growthPercent,
  totalGroups,
  avgPerGroup,
  monthly,
  locations,
  teachers,
  courses,
}: ActiveStatisticsProps) {
  return (
    <div className="space-y-2">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiCard
          title="Всего активных"
          value={totalStudents}
          icon={Users}
          subtitle="учеников в системе"
        />
        <KpiCard
          title="Новых в этом месяце"
          value={newThisMonth}
          icon={TrendingUp}
          trend={growthPercent !== 0 ? { value: growthPercent, label: 'vs прошлый' } : undefined}
          subtitle={growthPercent === 0 ? 'нет данных за прошлый месяц' : undefined}
        />
        <KpiCard
          title="Групп"
          value={totalGroups}
          icon={Layers}
          subtitle={`~${avgPerGroup} учеников на группу`}
        />
        <KpiCard
          title="Топ курс"
          value={courses[0]?.name ?? '-'}
          icon={GraduationCap}
          subtitle={courses[0] ? `${courses[0].count} учеников` : undefined}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-2 lg:grid-cols-5">
        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Динамика набора</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ChartContainer config={trendConfig} className="h-40 w-full">
              <AreaChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
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
                  fill="url(#activeGrad)"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Distribution */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Распределение (Топ-5)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-3">
              <CompactBarList data={courses} title="По курсам" color="var(--chart-1)" />
              <CompactBarList data={teachers} title="По преподавателям" color="var(--chart-3)" />
              <CompactBarList data={locations} title="По локациям" color="var(--chart-2)" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
