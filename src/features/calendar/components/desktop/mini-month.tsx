'use client'

import { Button } from '@/src/components/ui/button'
import { cn } from '@/src/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarController } from '../../hooks/use-calendar'
import { DOW_NARROW, MONTHS } from '../../lib/constants'
import { dowOrder, monthGrid, todayYmd, ymd } from '../../lib/date-utils'

export function MiniMonth({ ctrl }: { ctrl: CalendarController }) {
  const c = ctrl.curr
  const y = c.getFullYear()
  const m = c.getMonth()
  const cells = monthGrid(y, m, ctrl.weekStart)
  const order = dowOrder(ctrl.weekStart)
  const today = todayYmd()

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <span className="text-[13px] font-semibold tracking-tight">
          {MONTHS[m]} {y}
        </span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => ctrl.shiftMiniMonth(-1)}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => ctrl.shiftMiniMonth(1)}
            aria-label="Следующий месяц"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {order.map((di, i) => (
          <div
            key={`h${i}`}
            className="text-muted-foreground/70 pb-1.5 text-center text-[9.5px] font-semibold"
          >
            {DOW_NARROW[di]}
          </div>
        ))}
        {cells.map((day, i) => {
          const ds = ymd(day)
          const inMonth = day.getMonth() === m
          const isToday = ds === today
          const selected = ds === ctrl.currentDate
          const hasEvents = ctrl.eventsOn(ds).length > 0
          return (
            <button
              key={i}
              onClick={() => ctrl.setCurrentDate(ds)}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-full text-[11px] tabular-nums transition-colors',
                isToday
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : selected
                    ? 'bg-muted text-foreground font-semibold'
                    : 'hover:bg-muted/60',
                !isToday && !selected && (inMonth ? 'text-foreground' : 'text-muted-foreground/50'),
              )}
            >
              {day.getDate()}
              {hasEvents && !isToday && (
                <span
                  className={cn(
                    'absolute bottom-1 left-1/2 size-[3px] -translate-x-1/2 rounded-full',
                    selected ? 'bg-foreground' : 'bg-muted-foreground',
                  )}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
