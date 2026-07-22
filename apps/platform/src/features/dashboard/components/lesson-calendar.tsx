'use client'
import { Calendar } from '@/src/components/ui/calendar'
import { ru } from 'date-fns/locale'
import type { DashboardCalendarDaySummaryMap } from '../types'
import { LessonDayButton } from './calendar-day-button'

interface LessonCalendarProps {
  selectedDay: Date
  visibleMonth: Date
  daySummaries: DashboardCalendarDaySummaryMap
  onSelectDay: (day: Date) => void
  onMonthChange: (month: Date) => void
}

export function LessonCalendar({
  selectedDay,
  visibleMonth,
  daySummaries,
  onSelectDay,
  onMonthChange,
}: LessonCalendarProps) {
  return (
    <Calendar
      mode="single"
      required
      selected={selectedDay}
      onSelect={(day) => {
        if (day) {
          onSelectDay(day)
        }
      }}
      month={visibleMonth}
      onMonthChange={onMonthChange}
      classNames={{ week: 'mt-2 flex gap-2' }}
      components={{
        DayButton: (props) => <LessonDayButton {...props} daySummaries={daySummaries} />,
      }}
      showOutsideDays={false}
      locale={ru}
      className="bg-transparent p-0 [--cell-size:--spacing(8.5)] sm:[--cell-size:--spacing(9.5)]"
      captionLayout="dropdown"
    />
  )
}
