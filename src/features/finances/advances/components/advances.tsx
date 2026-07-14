'use client'

import { Hint } from '@/src/components/hint'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/src/components/ui/empty'
import { Skeleton } from '@/src/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table'
import { DEFAULT_CHARGEABLE_STATUSES } from '@/src/features/finances/chargeable'
import { dateToYmd } from '@/src/lib/timezone'
import {
  Banknote,
  CalendarSearch,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAdvancesDataQuery } from '../queries'
import type { AdvancesFilters } from '../schemas'
import type { AdvanceTotals, StudentAdvanceRow } from '../types'
import AdvancesFiltersBar, { type AdvancesFilterState } from './advances-filters'

function formatRub(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function AdvancesSkeleton() {
  return (
    <>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------
function SummaryCards({ totals }: { totals: AdvanceTotals }) {
  const advanceChange = totals.advanceAtEnd - totals.advanceAtStart
  const advanceChangeSign = advanceChange > 0 ? '+' : ''

  return (
    <div className="space-y-2">
      {/* Main financial flow */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <TrendingUp className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Аванс на начало
              </p>
              <Hint text="Оплачено до периода минус выручка до периода" />
            </div>
            <p className="text-2xl font-semibold text-blue-600 tabular-nums">
              {formatRub(Math.floor(totals.advanceAtStart))}
            </p>
            <p className="text-muted-foreground text-[0.5625rem] tabular-nums">
              {formatRub(Math.floor(totals.paidBefore))} опл. −{' '}
              {formatRub(Math.floor(totals.revenueBefore))} выр.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <DollarSign className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Оплачено
              </p>
              <Hint text="Сумма всех оплат внутри периода" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{formatRub(totals.paidInPeriod)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <Banknote className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Выручка
              </p>
              <Hint text="Сумма стоимости всех списанных посещений за период" />
            </div>
            <p className="text-2xl font-semibold text-green-600 tabular-nums">
              {formatRub(Math.floor(totals.revenueInPeriod))}
            </p>
            <p className="text-muted-foreground text-[0.5625rem] tabular-nums">
              ≈ {formatRub(Math.floor(totals.avgCostPerVisit))} / посещение
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <TrendingDown className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Аванс на конец
              </p>
              <Hint text="Входящий аванс + оплачено − выручка" />
            </div>
            <p
              className={`text-2xl font-semibold tabular-nums ${totals.advanceAtEnd < 0 ? 'text-red-600' : 'text-blue-600'}`}
            >
              {formatRub(Math.floor(totals.advanceAtEnd))}
            </p>
            <p className="text-muted-foreground text-[0.5625rem] tabular-nums">
              {advanceChangeSign}
              {formatRub(Math.floor(advanceChange))} за период
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance & students breakdown */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <Users className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Посещений
              </p>
              <Hint text="Общее количество записей посещений за период" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{totals.totalAttendances}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Списано
              </p>
              <Hint text="Количество посещений, по которым была начислена выручка" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{totals.chargedInPeriod}</p>
            <p className="text-muted-foreground text-[0.5625rem] tabular-nums">
              {totals.chargeRate}% от посещений
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <CalendarSearch className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Студентов
              </p>
              <Hint text="Количество активных студентов с оплатами или посещениями" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{totals.activeStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-1">
              <TrendingDown className="text-muted-foreground size-3" />
              <p className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                Должников
              </p>
              <Hint text="Студенты с отрицательным авансом на конец периода" />
            </div>
            <p
              className={`text-2xl font-semibold tabular-nums ${totals.negativeBalanceStudents > 0 ? 'text-red-600' : ''}`}
            >
              {totals.negativeBalanceStudents}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Students table
// ---------------------------------------------------------------------------
function StudentsTable({
  students,
  totals,
}: {
  students: StudentAdvanceRow[]
  totals: AdvanceTotals
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Студент</TableHead>
          <TableHead className="text-right">Всего опл.</TableHead>
          <TableHead className="text-right">Занятий опл.</TableHead>
          <TableHead className="text-right">₽/занятие</TableHead>
          <TableHead className="text-right">Опл. до</TableHead>
          <TableHead className="text-right">Аванс до</TableHead>
          <TableHead className="text-right">Опл. в пер.</TableHead>
          <TableHead className="text-right">Посещений</TableHead>
          <TableHead className="text-right">Списано</TableHead>
          <TableHead className="text-right">Выручка</TableHead>
          <TableHead className="text-right">Остаток</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell className="text-right tabular-nums">{formatRub(r.totalPaid)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.totalLessonsPaid}</TableCell>
            <TableCell className="text-right tabular-nums">
              {r.avgCostPerLesson > 0 ? formatRub(Math.floor(r.avgCostPerLesson)) : '-'}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatRub(r.paidBefore)}</TableCell>
            <TableCell className="text-right text-blue-600 tabular-nums">
              {formatRub(Math.floor(r.advanceAtStart))}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatRub(r.paidInPeriod)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.totalAttendancesInPeriod}</TableCell>
            <TableCell className="text-right tabular-nums">{r.chargedInPeriodCount}</TableCell>
            <TableCell className="text-right text-green-600 tabular-nums">
              {formatRub(Math.floor(r.revenueInPeriod))}
            </TableCell>
            <TableCell
              className={`text-right font-medium tabular-nums ${
                r.advanceAtEnd > 0 ? 'text-blue-600' : r.advanceAtEnd < 0 ? 'text-red-600' : ''
              }`}
            >
              {formatRub(Math.floor(r.advanceAtEnd))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow className="font-bold">
          <TableCell>Итого ({students.length})</TableCell>
          <TableCell className="text-right tabular-nums">{formatRub(totals.totalPaid)}</TableCell>
          <TableCell className="text-right">-</TableCell>
          <TableCell className="text-right">-</TableCell>
          <TableCell className="text-right">-</TableCell>
          <TableCell className="text-right text-blue-600 tabular-nums">
            {formatRub(Math.floor(totals.advanceAtStart))}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatRub(totals.paidInPeriod)}
          </TableCell>
          <TableCell className="text-right tabular-nums">{totals.totalAttendances}</TableCell>
          <TableCell className="text-right tabular-nums">{totals.chargedInPeriod}</TableCell>
          <TableCell className="text-right text-green-600 tabular-nums">
            {formatRub(Math.floor(totals.revenueInPeriod))}
          </TableCell>
          <TableCell
            className={`text-right tabular-nums ${
              totals.advanceAtEnd > 0
                ? 'text-blue-600'
                : totals.advanceAtEnd < 0
                  ? 'text-red-600'
                  : ''
            }`}
          >
            {formatRub(Math.floor(totals.advanceAtEnd))}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const initialFilterState: AdvancesFilterState = {
  dateRange: undefined,
  selectedStatuses: [...DEFAULT_CHARGEABLE_STATUSES],
}

export default function Advances() {
  const [filterState, setFilterState] = useState<AdvancesFilterState>(initialFilterState)

  const filters: AdvancesFilters | null = useMemo(() => {
    const { dateRange, selectedStatuses } = filterState
    if (!dateRange?.from || !dateRange?.to) return null
    if (selectedStatuses.length === 0) return null
    return {
      startDate: dateToYmd(dateRange.from),
      endDate: dateToYmd(dateRange.to),
      chargeableStatuses: selectedStatuses,
    }
  }, [filterState])

  const { data, isPending, isError, error } = useAdvancesDataQuery(filters)
  const isLoading = isPending && !!filters

  return (
    <>
      <AdvancesFiltersBar filterState={filterState} setFilterState={setFilterState} />

      {/* Empty state - no date range selected */}
      {!filters && (
        <Empty className="bg-card ring-foreground/10 h-full ring-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarSearch />
            </EmptyMedia>
            <EmptyTitle>Период не выбран</EmptyTitle>
            <EmptyDescription>
              Укажите диапазон дат, чтобы увидеть авансы и выручку по студентам
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <Empty className="bg-card ring-destructive/20 h-full ring-1">
          <EmptyHeader>
            <EmptyTitle>Ошибка загрузки</EmptyTitle>
            <EmptyDescription>
              {error instanceof Error ? error.message : 'Не удалось загрузить данные'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Loading state */}
      {isLoading && <AdvancesSkeleton />}

      {/* Data loaded */}
      {data && !isLoading && (
        <>
          <SummaryCards totals={data.totals} />

          <Card>
            <CardHeader>
              <CardTitle>По студентам</CardTitle>
              <CardDescription>
                Период: {data.periodLabel} · Учеников с данными: {data.students.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <StudentsTable students={data.students} totals={data.totals} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
