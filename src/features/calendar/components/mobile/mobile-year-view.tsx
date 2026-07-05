'use client'

import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import { DAY_STATUS_COLORS, DOW_NARROW, MONTHS } from '../../lib/constants'
import { dowOrder, monthGrid, todayYmd, ymd } from '../../lib/date-utils'

function MiniMonthCard({
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
  const today = todayYmd()

  return (
    <button
      onClick={() => {
        ctrl.setCurrentDate(ymd(new Date(year, month, 1)))
        ctrl.setView('month')
      }}
      className="rounded-xl border p-[12px_12px_10px] text-left"
    >
      <div className="mb-2 text-[14px] font-semibold tracking-tight">{MONTHS[month]}</div>
      <div className="grid grid-cols-7 gap-px">
        {order.map((di, i) => (
          <div
            key={`h${i}`}
            className="text-muted-foreground/70 pb-[3px] text-center text-[8.5px] font-semibold"
          >
            {DOW_NARROW[di]}
          </div>
        ))}
        {cells.map((day, i) => {
          const inMonth = day.getMonth() === month
          const ds = ymd(day)
          const isToday = ds === today
          const dayEvents = inMonth ? ctrl.eventsOn(ds) : []
          const firstEvent = dayEvents[0]
          const status = inMonth ? ctrl.dayStatus(ds) : null
          return (
            <div
              key={i}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-full text-[9.5px] tabular-nums',
                isToday
                  ? 'bg-primary text-primary-foreground font-bold'
                  : inMonth
                    ? 'text-muted-foreground'
                    : 'text-transparent',
              )}
            >
              {day.getDate()}
              {firstEvent && !isToday && (
                <span
                  className="absolute bottom-0 size-[3px] rounded-full"
                  style={{
                    background: status ? DAY_STATUS_COLORS[status] : 'var(--muted-foreground)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </button>
  )
}

export function MobileYearView({ ctrl }: { ctrl: CalendarController }) {
  const year = ctrl.curr.getFullYear()
  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-auto p-4 pb-28">
      <div className="grid grid-cols-2 gap-3.5">
        {Array.from({ length: 12 }, (_, m) => (
          <MiniMonthCard key={m} ctrl={ctrl} year={year} month={m} />
        ))}
      </div>
    </div>
  )
}
