'use client'

import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import { DAY_STATUS_COLORS, DOW_NARROW, MONTHS } from '../../lib/constants'
import { dowOrder, monthGrid, todayYmd, ymd } from '../../lib/date-utils'

function MiniMonthBlock({
  ctrl,
  year,
  month,
}: {
  ctrl: CalendarController
  year: number
  month: number
}) {
  const cells = monthGrid(year, month, ctrl.weekStart)
  const order = dowOrder(ctrl.weekStart)
  const today = todayYmd(ctrl.tz)

  return (
    <div className="bg-card rounded-lg border px-3.5 pt-3.5 pb-2.5">
      <button
        onClick={() => {
          ctrl.setCurrentDate(ymd(new Date(year, month, 1)))
          ctrl.setView('month')
        }}
        className="hover:text-primary mb-2.5 text-sm font-semibold tracking-tight transition-colors"
      >
        {MONTHS[month]}
      </button>
      <div className="grid grid-cols-7 gap-px">
        {order.map((di, i) => (
          <div
            key={`h${i}`}
            className="text-muted-foreground/70 pb-1 text-center text-xs font-semibold"
          >
            {DOW_NARROW[di]}
          </div>
        ))}
        {cells.map((day, i) => {
          const inMonth = day.getMonth() === month
          const ds = ymd(day)
          const isToday = ds === today
          const firstEvent = inMonth ? ctrl.eventsOn(ds)[0] : undefined
          const status = inMonth ? ctrl.dayStatus(ds) : null
          return (
            <div
              key={i}
              onClick={
                inMonth
                  ? () => {
                      ctrl.setCurrentDate(ds)
                      ctrl.setView('day')
                    }
                  : undefined
              }
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-full text-xs tabular-nums',
                inMonth ? 'cursor-pointer' : 'cursor-default',
                isToday
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : inMonth
                    ? 'text-muted-foreground hover:bg-muted'
                    : 'text-transparent',
              )}
            >
              {day.getDate()}
              {firstEvent && !isToday && (
                <span
                  className="absolute bottom-px size-0.75 rounded-full"
                  style={{
                    background: status ? DAY_STATUS_COLORS[status] : 'var(--muted-foreground)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function YearView({ ctrl }: { ctrl: CalendarController }) {
  const year = ctrl.curr.getFullYear()
  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-auto px-6 py-6.5">
      <div className="mx-auto grid max-w-280 grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => (
          <MiniMonthBlock key={m} ctrl={ctrl} year={year} month={m} />
        ))}
      </div>
    </div>
  )
}
