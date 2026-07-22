'use client'

import { Hint } from '@/src/components/hint'
import { StatCard } from '@/src/components/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/src/components/ui/chart'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/src/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { nowInTz } from '@/src/lib/timezone'
import {
  Banknote,
  Building2,
  ChevronDown,
  CreditCard,
  Landmark,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { parseAsInteger, useQueryState } from 'nuqs'
import { Fragment, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useProfitMonthlyQuery } from '../queries'
import type { ProfitMonthEntry } from '../types'
import { formatCurrency } from '@/src/lib/utils'

const MONTH_FULL_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

function formatCompact(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPercent(part: number, total: number) {
  if (total === 0) return '-%'
  return `${((part / total) * 100).toFixed(1)}%`
}

const chartConfig = {
  profit: { label: 'Прибыль', color: '#10b981' }, // green-500
  revenue: { label: 'Выручка', color: '#3b82f6' }, // blue-500
  salaries: { label: 'Зарплаты', color: '#f97316' }, // orange-500
  rent: { label: 'Аренда', color: '#8b5cf6' }, // violet-500
  taxes: { label: 'Налоги', color: '#ef4444' }, // red-500
  acquiring: { label: 'Эквайринг', color: '#ec4899' }, // fuchsia-500
  expenses: { label: 'Прочее', color: '#64748b' }, // slate-500
} satisfies ChartConfig

const EXPENSE_ROWS: { key: keyof ProfitMonthEntry; label: string; color: string }[] = [
  { key: 'salaries', label: 'Зарплаты', color: chartConfig.salaries.color },
  { key: 'rent', label: 'Аренда', color: chartConfig.rent.color },
  { key: 'taxes', label: 'Налоги', color: chartConfig.taxes.color },
  { key: 'acquiring', label: 'Эквайринг', color: chartConfig.acquiring.color },
  { key: 'expenses', label: 'Прочее', color: chartConfig.expenses.color },
]

function MonthlyTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ProfitMonthEntry }>
}) {
  if (!active || !payload?.length) return null
  const month = payload[0]?.payload
  if (!month) return null

  const totalExpenses = month.taxes + month.acquiring + month.salaries + month.rent + month.expenses
  const isPositive = month.profit >= 0

  return (
    <div className="bg-popover text-popover-foreground min-w-64 rounded-lg border p-3 text-xs shadow-md">
      <div className="mb-2 flex items-baseline justify-between gap-3 border-b pb-2">
        <span className="font-semibold">
          {MONTH_FULL_RU[month.monthIndex]} {new Date(month.startDate).getFullYear()}
        </span>
      </div>

      <div className="my-2 flex items-center justify-between gap-3 border-b pb-2">
        <span className="flex items-center gap-1.5 font-semibold">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: chartConfig.revenue.color }}
          />
          Выручка
        </span>
        <span className={`font-mono font-semibold tabular-nums`}>
          {formatCurrency(month.revenue)}
        </span>
      </div>

      <div className="space-y-1">
        {EXPENSE_ROWS.map(({ key, label, color }) => {
          const value = month[key] as number
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground">{label}</span>
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-muted-foreground text-[0.625rem] tabular-nums">
                  {formatPercent(value, month.revenue)}
                </span>
                <span className="font-mono tabular-nums">{formatCurrency(value)}</span>
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2">
        <span className="text-muted-foreground">Итого расходы</span>
        <span className="flex items-baseline gap-2">
          <span className="text-muted-foreground text-[0.625rem] tabular-nums">
            {formatPercent(totalExpenses, month.revenue)}
          </span>
          <span className="font-mono tabular-nums">{formatCurrency(totalExpenses)}</span>
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-semibold">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: chartConfig.profit.color }}
          />
          Прибыль
        </span>
        <span
          className={`font-mono font-semibold tabular-nums ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {formatCurrency(month.profit)}
        </span>
      </div>
    </div>
  )
}

export default function ProfitMonthly() {
  const tz = useOrgTimezone()
  const currentYear = nowInTz(tz).getFullYear()
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i)

  const [year, setYear] = useQueryState(
    'year',
    parseAsInteger.withDefault(currentYear).withOptions({ shallow: false }),
  )

  const { data, isPending, isError, error } = useProfitMonthlyQuery(year)

  return (
    <>
      {/* Year selector */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">Год</span>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {data && (
              <span className="text-muted-foreground ml-auto text-xs">
                Налоги: {data.taxSystemLabel}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {isError && (
        <Empty className="bg-card ring-destructive/20 h-full ring-1">
          <EmptyHeader>
            <EmptyTitle>Ошибка загрузки</EmptyTitle>
            <EmptyDescription>
              {error instanceof Error ? error.message : 'Не удалось загрузить данные'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Loading */}
      {isPending && !isError && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      )}

      {/* Data */}
      {data && !isError && (
        <>
          <YearSummary totals={data.totals} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                Помесячная динамика
                <Hint text="Расходы и прибыль по каждому месяцу года." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <BarChart data={data.months} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => formatCompact(v)}
                  />
                  <ChartTooltip cursor={{ fillOpacity: 0.05 }} content={<MonthlyTooltip />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 4, 4]} />
                  <Bar
                    dataKey="taxes"
                    stackId="expenses"
                    fill="var(--color-taxes)"
                    radius={[4, 4, 4, 4]}
                  />
                  <Bar
                    dataKey="acquiring"
                    stackId="expenses"
                    fill="var(--color-acquiring)"
                    radius={[4, 4, 4, 4]}
                  />
                  <Bar
                    dataKey="salaries"
                    stackId="expenses"
                    fill="var(--color-salaries)"
                    radius={[4, 4, 4, 4]}
                  />
                  <Bar
                    dataKey="rent"
                    stackId="expenses"
                    fill="var(--color-rent)"
                    radius={[4, 4, 4, 4]}
                  />
                  <Bar
                    dataKey="expenses"
                    stackId="expenses"
                    fill="var(--color-expenses)"
                    radius={[4, 4, 4, 4]}
                  />
                  <Bar dataKey="profit" fill="var(--color-profit)" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Разбивка по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="by-pivot">
                <TabsList>
                  <TabsTrigger value="pivot">Сводная</TabsTrigger>
                  <TabsTrigger value="by-month">По месяцам</TabsTrigger>
                </TabsList>
                <TabsContent value="pivot">
                  <PivotTable months={data.months} totals={data.totals} />
                </TabsContent>
                <TabsContent value="by-month">
                  <MonthlyTable months={data.months} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}

function YearSummary({
  totals,
}: {
  totals: {
    revenue: number
    taxes: number
    acquiring: number
    salaries: number
    rent: number
    expenses: number
    profit: number
  }
}) {
  const isPositive = totals.profit >= 0
  return (
    <Card>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2">
            <StatCard
              label="Выручка за год"
              value={formatCurrency(totals.revenue)}
              icon={Banknote}
              variant="default"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Налоги"
              value={formatCurrency(totals.taxes)}
              icon={Landmark}
              variant="default"
            />
            <StatCard
              label="Эквайринг"
              value={formatCurrency(totals.acquiring)}
              icon={CreditCard}
              variant="default"
            />
            <StatCard
              label="Зарплаты"
              value={formatCurrency(totals.salaries)}
              icon={Users}
              variant="default"
            />
            <StatCard
              label="Аренда"
              value={formatCurrency(totals.rent)}
              icon={Building2}
              variant="default"
            />
            <StatCard
              label="Прочие расходы"
              value={formatCurrency(totals.expenses)}
              icon={Receipt}
              variant="default"
            />
            <StatCard
              label="Чистая прибыль"
              value={formatCurrency(totals.profit)}
              icon={isPositive ? TrendingUp : TrendingDown}
              variant={isPositive ? 'success' : 'danger'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MonthlyTable({ months }: { months: ProfitMonthEntry[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggle = (monthIndex: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(monthIndex)) next.delete(monthIndex)
      else next.add(monthIndex)
      return next
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="w-6 px-2 py-2 font-medium"></th>
            <th className="px-2 py-2 font-medium">Месяц</th>
            <th className="px-2 py-2 text-right font-medium">Выручка</th>
            <th className="px-2 py-2 text-right font-medium">Налоги</th>
            <th className="px-2 py-2 text-right font-medium">Эквайринг</th>
            <th className="px-2 py-2 text-right font-medium">Зарплаты</th>
            <th className="px-2 py-2 text-right font-medium">Аренда</th>
            <th className="px-2 py-2 text-right font-medium">Прочее</th>
            <th className="px-2 py-2 text-right font-medium">Прибыль</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const isOpen = expanded.has(m.monthIndex)
            return (
              <Fragment key={m.monthIndex}>
                <tr
                  className="hover:bg-muted/50 cursor-pointer border-b"
                  onClick={() => toggle(m.monthIndex)}
                >
                  <td className="px-2 py-2">
                    <ChevronDown
                      className={`size-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    />
                  </td>
                  <td className="px-2 py-2 font-medium capitalize">{m.label}</td>
                  <td className="px-2 py-2 text-right font-mono">{formatCurrency(m.revenue)}</td>
                  <td className="text-muted-foreground px-2 py-2 text-right font-mono">
                    {formatCurrency(m.taxes)}
                  </td>
                  <td className="text-muted-foreground px-2 py-2 text-right font-mono">
                    {formatCurrency(m.acquiring)}
                  </td>
                  <td className="text-muted-foreground px-2 py-2 text-right font-mono">
                    {formatCurrency(m.salaries)}
                  </td>
                  <td className="text-muted-foreground px-2 py-2 text-right font-mono">
                    {formatCurrency(m.rent)}
                  </td>
                  <td className="text-muted-foreground px-2 py-2 text-right font-mono">
                    {formatCurrency(m.expenses)}
                  </td>
                  <td
                    className={`px-2 py-2 text-right font-mono font-semibold ${m.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    {formatCurrency(m.profit)}
                  </td>
                </tr>
                {isOpen && <MonthDetailRows month={m} />}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Pivot (categories × months) ───────────────────────────────────────────

type CategoryKey = 'revenue' | 'taxes' | 'acquiring' | 'salaries' | 'rent' | 'expenses' | 'profit'

const CATEGORY_ROWS: {
  key: CategoryKey
  label: string
  color?: string
  tone?: 'income' | 'expense' | 'profit'
}[] = [
  { key: 'revenue', label: 'Выручка', tone: 'income', color: chartConfig.revenue.color },
  { key: 'taxes', label: 'Налоги', color: chartConfig.taxes.color, tone: 'expense' },
  { key: 'acquiring', label: 'Эквайринг', color: chartConfig.acquiring.color, tone: 'expense' },
  { key: 'salaries', label: 'Зарплаты', color: chartConfig.salaries.color, tone: 'expense' },
  { key: 'rent', label: 'Аренда', color: chartConfig.rent.color, tone: 'expense' },
  { key: 'expenses', label: 'Прочее', color: chartConfig.expenses.color, tone: 'expense' },
  { key: 'profit', label: 'Прибыль', color: chartConfig.profit.color, tone: 'profit' },
]

type SubRow = { label: string; values: number[]; total: number }

function collectSubRows(months: ProfitMonthEntry[], category: CategoryKey): SubRow[] {
  if (category === 'revenue' || category === 'profit') return []

  if (category === 'taxes') {
    const incomeTax = months.map((m) => m.breakdowns.taxes.incomeTax)
    const insurance = months.map((m) => m.breakdowns.taxes.insuranceContributions)
    const fixed = months.map((m) => m.breakdowns.taxes.fixedContributions)
    const first = months[0]?.breakdowns.taxes
    return [
      {
        label: `Налог на доход${first ? ` (${first.incomeTaxRate}%)` : ''}`,
        values: incomeTax,
        total: incomeTax.reduce((s, v) => s + v, 0),
      },
      {
        label: 'Страховые (1% сверх порога)',
        values: insurance,
        total: insurance.reduce((s, v) => s + v, 0),
      },
      {
        label: 'Фиксированные взносы',
        values: fixed,
        total: fixed.reduce((s, v) => s + v, 0),
      },
    ]
  }

  if (category === 'salaries') {
    const lessons = months.map((m) => m.breakdowns.salaries.totalFromLessons)
    const paychecks = months.map((m) => m.breakdowns.salaries.totalFromPaychecks)
    const managerFixed = months.map((m) => m.breakdowns.salaries.totalFromManagerFixed)
    const managerPaychecks = months.map((m) => m.breakdowns.salaries.totalFromManagerPaychecks)
    return [
      {
        label: 'Оплата за уроки',
        values: lessons,
        total: lessons.reduce((s, v) => s + v, 0),
      },
      {
        label: 'Начисления преподавателям',
        values: paychecks,
        total: paychecks.reduce((s, v) => s + v, 0),
      },
      {
        label: 'Фикс. зарплаты менеджеров',
        values: managerFixed,
        total: managerFixed.reduce((s, v) => s + v, 0),
      },
      {
        label: 'Начисления менеджерам',
        values: managerPaychecks,
        total: managerPaychecks.reduce((s, v) => s + v, 0),
      },
    ]
  }

  if (category === 'acquiring') {
    const keys = new Map<string, { label: string; values: number[] }>()
    months.forEach((m, i) => {
      for (const item of m.breakdowns.acquiring) {
        const k = `${item.methodName}|${item.commissionPercent}`
        if (!keys.has(k)) {
          keys.set(k, {
            label: `${item.methodName} (${item.commissionPercent}%)`,
            values: new Array<number>(12).fill(0),
          })
        }
        keys.get(k)!.values[i] = item.fee
      }
    })
    return Array.from(keys.values())
      .map((row) => ({ ...row, total: row.values.reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total)
  }

  if (category === 'rent') {
    const keys = new Map<string, number[]>()
    months.forEach((m, i) => {
      for (const item of m.breakdowns.rent) {
        if (!keys.has(item.locationName)) keys.set(item.locationName, new Array<number>(12).fill(0))
        keys.get(item.locationName)![i] = item.amount
      }
    })
    return Array.from(keys.entries())
      .map(([label, values]) => ({ label, values, total: values.reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total)
  }

  if (category === 'expenses') {
    const keys = new Map<string, number[]>()
    months.forEach((m, i) => {
      for (const item of m.breakdowns.expenses) {
        if (!keys.has(item.name)) keys.set(item.name, new Array<number>(12).fill(0))
        keys.get(item.name)![i] = item.amount
      }
    })
    return Array.from(keys.entries())
      .map(([label, values]) => ({ label, values, total: values.reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total)
  }

  return []
}

function PivotTable({
  months,
  totals,
}: {
  months: ProfitMonthEntry[]
  totals: {
    revenue: number
    taxes: number
    acquiring: number
    salaries: number
    rent: number
    expenses: number
    profit: number
  }
}) {
  const [expanded, setExpanded] = useState<Set<CategoryKey>>(new Set())

  const toggle = (key: CategoryKey) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-4xl text-xs">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="bg-card sticky left-0 z-10 w-6 px-2 py-2 font-medium"></th>
            <th className="bg-card sticky left-6 z-10 px-2 py-2 font-medium">Категория</th>
            {months.map((m) => (
              <th key={m.monthIndex} className="px-2 py-2 text-right font-medium capitalize">
                {m.label}
              </th>
            ))}
            <th className="bg-card px-2 py-2 text-right font-medium">Итого</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ROWS.map((row) => {
            const values = months.map((m) => m[row.key])
            const total = totals[row.key]
            const isExpandable = row.key !== 'profit'
            const isOpen = expanded.has(row.key)
            const subRows = isOpen ? collectSubRows(months, row.key) : []

            const toneClass =
              row.tone === 'profit'
                ? total >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
                : ''

            return (
              <Fragment key={row.key}>
                <tr
                  className={`border-b ${isExpandable ? 'hover:bg-muted/50 cursor-pointer' : ''} ${row.tone === 'income' || row.tone === 'profit' ? 'font-semibold' : ''}`}
                  onClick={() => isExpandable && toggle(row.key)}
                >
                  <td className="bg-card sticky left-0 z-10 px-2 py-2">
                    {isExpandable && (
                      <ChevronDown
                        className={`size-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                      />
                    )}
                  </td>
                  <td className="bg-card sticky left-6 z-10 px-2 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {row.color && (
                        <span
                          className="size-2 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: row.color }}
                        />
                      )}
                      {row.label}
                    </span>
                  </td>
                  {values.map((v, i) => (
                    <td
                      key={i}
                      className={`px-2 py-2 text-right font-mono tabular-nums ${row.tone === 'expense' ? 'text-muted-foreground' : toneClass}`}
                    >
                      {formatCurrency(v)}
                    </td>
                  ))}
                  <td
                    className={`bg-card px-2 py-2 text-right font-mono font-semibold tabular-nums ${toneClass}`}
                  >
                    {formatCurrency(total)}
                  </td>
                </tr>
                {isOpen &&
                  subRows.map((sub) => (
                    <tr key={`${row.key}-${sub.label}`} className="bg-card border-b">
                      <td className="bg-card sticky left-0 z-10 px-2 py-1.5" />
                      <td className="bg-card text-muted-foreground sticky left-6 z-10 px-2 py-1.5 pl-6 text-[0.6875rem]">
                        {sub.label}
                      </td>
                      {sub.values.map((v, i) => (
                        <td
                          key={i}
                          className="text-muted-foreground px-2 py-1.5 text-right font-mono text-[0.6875rem] tabular-nums"
                        >
                          {v === 0 ? '-' : formatCurrency(Math.round(v))}
                        </td>
                      ))}
                      <td className="bg-card text-muted-foreground px-2 py-1.5 text-right font-mono text-[0.6875rem] tabular-nums">
                        {formatCurrency(Math.round(sub.total))}
                      </td>
                    </tr>
                  ))}
                {isOpen && subRows.length === 0 && (
                  <tr className="bg-card border-b">
                    <td
                      colSpan={months.length + 3}
                      className="text-muted-foreground px-2 py-2 pl-6 text-center text-[0.6875rem]"
                    >
                      Нет детализации за выбранный период
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Detail rows for a single month (used inside MonthlyTable) ────────────

const CATEGORY_COL_INDEX: Record<Exclude<CategoryKey, 'revenue' | 'profit'>, number> = {
  taxes: 3,
  acquiring: 4,
  salaries: 5,
  rent: 6,
  expenses: 7,
}

function MonthDetailRows({ month }: { month: ProfitMonthEntry }) {
  // Build sub-rows per category for this single month using the same logic as pivot
  const detail = (['taxes', 'acquiring', 'salaries', 'rent', 'expenses'] as const).flatMap(
    (cat) => {
      const rows = collectSubRows([month], cat)
      return rows
        .map((sub) => ({
          category: cat,
          label: sub.label,
          value: sub.values[0] ?? 0,
        }))
        .filter((r) => r.value !== 0)
    },
  )

  if (detail.length === 0) {
    return (
      <tr className="bg-card border-b last:border-b-0">
        <td colSpan={9} className="text-muted-foreground px-2 py-2 pl-10 text-[0.6875rem]">
          Нет детализации за выбранный месяц
        </td>
      </tr>
    )
  }

  return (
    <>
      {detail.map((row, i) => {
        const colIndex = CATEGORY_COL_INDEX[row.category]
        const meta = CATEGORY_ROWS.find((c) => c.key === row.category)
        return (
          <tr key={`detail-${month.monthIndex}-${i}`} className="bg-card border-b last:border-b-0">
            <td className="bg-card px-2 py-1.5" />
            <td className="text-muted-foreground bg-card px-2 py-1.5 pl-8 text-[0.6875rem]">
              <span className="inline-flex items-center gap-1.5">
                {meta?.color && (
                  <span
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: meta.color }}
                  />
                )}
                {row.label}
              </span>
            </td>
            {[2, 3, 4, 5, 6, 7, 8].map((col) => (
              <td
                key={col}
                className="text-muted-foreground bg-card px-2 py-1.5 text-right font-mono text-[0.6875rem] tabular-nums"
              >
                {col === colIndex ? formatCurrency(Math.round(row.value)) : ''}
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}
