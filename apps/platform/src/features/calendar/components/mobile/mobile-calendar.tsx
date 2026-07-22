'use client'

import type { CalendarController } from '../../hooks/use-calendar'
import { ListView } from '../list-view'
import { MobileDayView } from './mobile-day-view'
import { MobileHeader } from './mobile-header'
import { MobileMonthView } from './mobile-month-view'
import { MobileWeekView } from './mobile-week-view'
import { MobileYearView } from './mobile-year-view'

export function MobileCalendar({ ctrl }: { ctrl: CalendarController }) {
  const { view } = ctrl

  let surface: React.ReactNode
  if (view === 'day') surface = <MobileDayView ctrl={ctrl} />
  else if (view === 'week') surface = <MobileWeekView ctrl={ctrl} />
  else if (view === 'month') surface = <MobileMonthView ctrl={ctrl} />
  else if (view === 'list') surface = <ListView ctrl={ctrl} />
  else surface = <MobileYearView ctrl={ctrl} />

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <MobileHeader ctrl={ctrl} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{surface}</div>
    </div>
  )
}
