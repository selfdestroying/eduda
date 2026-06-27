'use client'

import type { CalendarController } from '../../hooks/use-calendar'
import { addDays, startOfWeek } from '../../lib/date-utils'
import { ListView } from '../list-view'
import { CalendarHeader } from './calendar-header'
import { CalendarSidebar } from './calendar-sidebar'
import { MonthView } from './month-view'
import { Timeline } from './timeline'
import { YearView } from './year-view'

export function DesktopCalendar({ ctrl }: { ctrl: CalendarController }) {
  const { view, curr, weekStart } = ctrl

  let surface: React.ReactNode
  if (view === 'day') {
    surface = <Timeline ctrl={ctrl} days={[curr]} />
  } else if (view === 'week') {
    const s = startOfWeek(curr, weekStart)
    surface = <Timeline ctrl={ctrl} days={Array.from({ length: 7 }, (_, i) => addDays(s, i))} />
  } else if (view === 'month') {
    surface = <MonthView ctrl={ctrl} />
  } else if (view === 'list') {
    surface = <ListView ctrl={ctrl} />
  } else {
    surface = <YearView ctrl={ctrl} />
  }

  return (
    <div className="flex min-h-0 flex-1">
      <CalendarSidebar ctrl={ctrl} />
      <main className="flex min-w-0 flex-1 flex-col">
        <CalendarHeader ctrl={ctrl} />
        <div className="flex min-h-0 flex-1 flex-col">{surface}</div>
      </main>
    </div>
  )
}
