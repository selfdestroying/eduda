'use client'

import TableFilter, { type TableFilterItem } from '@/src/components/table-filter'
import { Button } from '@/src/components/ui/button'
import { Calendar } from '@/src/components/ui/calendar'
import { Card, CardContent } from '@/src/components/ui/card'
import { Checkbox } from '@/src/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { useMappedCourseListQuery } from '@/src/features/courses/queries'
import { useMappedLocationListQuery } from '@/src/features/locations/queries'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { nowInTz } from '@/src/lib/timezone'
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { type ChargeableStatus, CHARGEABLE_STATUS_OPTIONS } from '../../chargeable'

// getValue ленивый — момент берётся при клике
function makeDatePresets(tz: string) {
  return [
    {
      label: 'Текущая неделя',
      getValue: () => ({
        from: startOfWeek(nowInTz(tz), { weekStartsOn: 1 }),
        to: endOfWeek(nowInTz(tz), { weekStartsOn: 1 }),
      }),
    },
    {
      label: 'Прошлая неделя',
      getValue: () => ({
        from: startOfWeek(subWeeks(nowInTz(tz), 1), { weekStartsOn: 1 }),
        to: endOfWeek(subWeeks(nowInTz(tz), 1), { weekStartsOn: 1 }),
      }),
    },
    {
      label: 'Текущий месяц',
      getValue: () => ({
        from: startOfMonth(nowInTz(tz)),
        to: endOfMonth(nowInTz(tz)),
      }),
    },
    {
      label: 'Прошлый месяц',
      getValue: () => ({
        from: startOfMonth(subMonths(nowInTz(tz), 1)),
        to: endOfMonth(subMonths(nowInTz(tz), 1)),
      }),
    },
  ]
}

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
  const tz = useOrgTimezone()
  const datePresets = useMemo(() => makeDatePresets(tz), [tz])
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const { data: courses = [] } = useMappedCourseListQuery()
  const { data: locations = [] } = useMappedLocationListQuery()
  const { data: teachers = [] } = useMappedMemberListQuery()

  const { dateRange, selectedCourses, selectedLocations, selectedTeachers } = filterState

  const handlePresetSelect = (preset: (typeof datePresets)[0]) => {
    setFilterState((prev) => ({ ...prev, dateRange: preset.getValue() }))
    setIsCalendarOpen(false)
  }

  const formatDateRange = () => {
    if (!dateRange?.from) return 'Выберите период'
    if (!dateRange.to) return format(dateRange.from, 'd MMM yyyy', { locale: ru })
    return `${format(dateRange.from, 'd MMM', { locale: ru })} - ${format(dateRange.to, 'd MMM yyyy', { locale: ru })}`
  }

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
          {/* Date range picker */}
          <div className="flex items-center gap-2">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="min-w-50 justify-start gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="truncate">{formatDateRange()}</span>
                    <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex">
                  {/* Presets */}
                  <div className="border-r p-2">
                    <div className="text-muted-foreground mb-2 px-2 text-xs font-medium">
                      Быстрый выбор
                    </div>
                    <div className="flex flex-col gap-1">
                      {datePresets.map((preset) => (
                        <Button
                          key={preset.label}
                          variant="ghost"
                          className="justify-start text-xs"
                          onClick={() => handlePresetSelect(preset)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {/* Calendar */}
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => setFilterState((prev) => ({ ...prev, dateRange: range }))}
                    locale={ru}
                    numberOfMonths={2}
                  />
                </div>
              </PopoverContent>
            </Popover>

            {dateRange && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFilterState((prev) => ({ ...prev, dateRange: undefined }))}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

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
