'use client'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/src/components/ui/empty'
import { Skeleton } from '@/src/components/ui/skeleton'
import { dateToYmd } from '@/src/lib/timezone'
import { CalendarSearch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DEFAULT_CHARGEABLE_STATUSES } from '../../chargeable'
import { useRevenueDataQuery } from '../queries'
import type { RevenueFilters } from '../schemas'
import RevenueFiltersBar, { type RevenueFilterState } from './revenue-filters'
import RevenueStatsCards from './revenue-stats'
import RevenueTimeline from './revenue-timeline'

const initialFilterState: RevenueFilterState = {
  dateRange: undefined,
  selectedCourses: [],
  selectedLocations: [],
  selectedTeachers: [],
  selectedStatuses: [...DEFAULT_CHARGEABLE_STATUSES],
}

export default function Revenue() {
  const [filterState, setFilterState] = useState<RevenueFilterState>(initialFilterState)

  const filters: RevenueFilters | null = useMemo(() => {
    const { dateRange, selectedCourses, selectedLocations, selectedTeachers, selectedStatuses } =
      filterState
    if (!dateRange?.from || !dateRange?.to) return null
    if (selectedStatuses.length === 0) return null
    return {
      startDate: dateToYmd(dateRange.from),
      endDate: dateToYmd(dateRange.to),
      courseIds: selectedCourses.length > 0 ? selectedCourses.map((c) => +c.value) : undefined,
      locationIds:
        selectedLocations.length > 0 ? selectedLocations.map((l) => +l.value) : undefined,
      teacherIds: selectedTeachers.length > 0 ? selectedTeachers.map((t) => +t.value) : undefined,
      chargeableStatuses: selectedStatuses,
    }
  }, [filterState])

  const { data, isPending, isError, error } = useRevenueDataQuery(filters)
  const isLoading = isPending && !!filters

  return (
    <>
      <RevenueFiltersBar filterState={filterState} setFilterState={setFilterState} />

      {/* Empty state - no date range selected */}
      {!filters && (
        <Empty className="bg-card ring-foreground/10 h-full ring-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarSearch />
            </EmptyMedia>
            <EmptyTitle>Период не выбран</EmptyTitle>
            <EmptyDescription>
              Укажите диапазон дат, чтобы увидеть расписание и статистику
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
      {isLoading && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </>
      )}

      {/* Data loaded */}
      {data && !isLoading && (
        <>
          <RevenueStatsCards stats={data.stats} isLoading={false} />
          <RevenueTimeline days={data.days} />
        </>
      )}
    </>
  )
}
