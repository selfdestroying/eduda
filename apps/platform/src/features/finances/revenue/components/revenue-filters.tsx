'use client'

import TableFilter, { type TableFilterItem } from '@repo/ui/components/table-filter'
import { Card, CardContent } from '@repo/ui/components/card'
import { Checkbox } from '@repo/ui/components/checkbox'
import DateRangeFilter from '@/src/components/date-range-filter'
import { useMappedCourseListQuery } from '@/src/features/courses/queries'
import { useMappedLocationListQuery } from '@/src/features/locations/queries'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { Dispatch, SetStateAction } from 'react'
import type { DateRange } from 'react-day-picker'
import { type ChargeableStatus, CHARGEABLE_STATUS_OPTIONS } from '../../chargeable'

export interface RevenueFilterState {
  dateRange: DateRange | undefined
  selectedCourses: TableFilterItem[]
  selectedLocations: TableFilterItem[]
  selectedTeachers: TableFilterItem[]
  selectedStatuses: ChargeableStatus[]
}

interface RevenueFiltersBarProps {
  filterState: RevenueFilterState
  setFilterState: Dispatch<SetStateAction<RevenueFilterState>>
}

export default function RevenueFiltersBar({ filterState, setFilterState }: RevenueFiltersBarProps) {
  const { data: courses = [] } = useMappedCourseListQuery()
  const { data: locations = [] } = useMappedLocationListQuery()
  const { data: teachers = [] } = useMappedMemberListQuery()

  const { dateRange, selectedCourses, selectedLocations, selectedTeachers } = filterState

  const toggleStatus = (value: ChargeableStatus, checked: boolean) => {
    setFilterState((prev) => ({
      ...prev,
      selectedStatuses: checked
        ? [...prev.selectedStatuses, value]
        : prev.selectedStatuses.filter((s) => s !== value),
    }))
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        {/* Row 1: Date + entity filters */}
        <div className="flex flex-col items-end gap-2 lg:flex-row lg:justify-between">
          <DateRangeFilter
            value={dateRange}
            onChange={(range) => setFilterState((prev) => ({ ...prev, dateRange: range }))}
          />

          {/* Entity filters */}
          <TableFilter
            label="Курс"
            items={courses}
            value={selectedCourses}
            onChange={(v) => setFilterState((prev) => ({ ...prev, selectedCourses: v }))}
          />
          <TableFilter
            label="Локация"
            items={locations}
            value={selectedLocations}
            onChange={(v) => setFilterState((prev) => ({ ...prev, selectedLocations: v }))}
          />
          <TableFilter
            label="Преподаватель"
            items={teachers}
            value={selectedTeachers}
            onChange={(v) => setFilterState((prev) => ({ ...prev, selectedTeachers: v }))}
          />
        </div>

        {/* Row 2: Chargeable statuses - inline checkboxes */}
        <div className="border-t pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-muted-foreground mt-1.5 text-xs font-medium whitespace-nowrap">
              Считать посещением:
            </span>

            {/* Посетил - standalone */}
            <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-sm">
              <Checkbox
                checked={filterState.selectedStatuses.includes('present')}
                onCheckedChange={(val) => toggleStatus('present', Boolean(val))}
              />
              Посетил
            </label>

            {/* Пропустил - bordered group */}
            <fieldset className="border-border flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border px-3 py-1.5">
              <legend className="text-muted-foreground px-1 text-xs">Пропустил</legend>
              {CHARGEABLE_STATUS_OPTIONS.filter((o) => o.value !== 'present').map((option) => {
                const checked = filterState.selectedStatuses.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(val) => toggleStatus(option.value, Boolean(val))}
                    />
                    {option.label}
                  </label>
                )
              })}
            </fieldset>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
