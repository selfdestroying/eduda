'use client'
import { CalendarDayButton } from '@/src/components/ui/calendar'
import { cn } from '@/src/lib/utils'
import type { CalendarDay } from 'react-day-picker'
import type { DashboardCalendarDaySummaryMap } from '../types'

interface CalendarDayButtonProps extends React.ComponentProps<typeof CalendarDayButton> {
  day: CalendarDay
  children?: React.ReactNode
  daySummaries: DashboardCalendarDaySummaryMap
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const dayStatusStyles = {
  marked: {
    tint: 'border-success/30 bg-success/10 text-success',
    dot: 'bg-success',
  },
  unmarked: {
    tint: 'border-destructive/30 bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
  },
  neutral: {
    tint: 'border-border/70 bg-muted/60 text-foreground',
    dot: 'bg-muted-foreground',
  },
} as const

export function LessonDayButton({
  day,
  children,
  className,
  modifiers,
  daySummaries,
  ...props
}: CalendarDayButtonProps) {
  const daySummary = daySummaries[toDateKey(day.date)]

  if (!daySummary) {
    return (
      <CalendarDayButton
        {...props}
        day={day}
        modifiers={modifiers}
        className={className}
        data-day={day.date.toLocaleDateString('ru-RU')}
      >
        {children}
      </CalendarDayButton>
    )
  }

  const visual =
    daySummary.status === 'marked'
      ? dayStatusStyles.marked
      : daySummary.status === 'unmarked'
        ? dayStatusStyles.unmarked
        : dayStatusStyles.neutral

  return (
    <CalendarDayButton
      {...props}
      day={day}
      modifiers={modifiers}
      className={cn(!modifiers.selected && visual.tint, 'transition-colors', className)}
      data-day={day.date.toLocaleDateString('ru-RU')}
    >
      {children}
    </CalendarDayButton>
  )
}
