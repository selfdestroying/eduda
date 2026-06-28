'use client'

import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import type { CalendarEvent } from '../../types'
import { DOW_SHORT } from '../../lib/constants'
import { dowOrder, fmtTime, hexA, monthGrid, sortEvents, todayYmd, ymd } from '../../lib/date-utils'

function Chip({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'mb-0.5 flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-[5px] px-1.5 py-0.5 text-[11.5px] leading-[1.35] font-medium whitespace-nowrap',
        ev.cancelled && 'opacity-50',
      )}
      style={{ background: hexA(ev.color, 0.1) }}
      title={ev.title}
    >
      <span className="text-muted-foreground flex-none text-[10.5px] tabular-nums">
        {fmtTime(ev.start)}
      </span>
      <span className={cn('overflow-hidden text-ellipsis', ev.cancelled && 'line-through')}>
        {ev.title}
      </span>
    </div>
  )
}

export function MonthView({ ctrl }: { ctrl: CalendarController }) {
  const c = ctrl.curr
  const m = c.getMonth()
  const cells = monthGrid(c.getFullYear(), m, ctrl.weekStart)
  const order = dowOrder(ctrl.weekStart)
  const today = todayYmd()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="bg-muted/40 grid grid-cols-7 border-b">
        {order.map((di, i) => (
          <div
            key={i}
            className="text-muted-foreground p-2.5 text-right text-[11px] font-semibold tracking-wide uppercase"
          >
            {DOW_SHORT[di]}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map((day) => {
          const ds = ymd(day)
          const inMonth = day.getMonth() === m
          const isToday = ds === today
          const evs = ctrl.eventsOn(ds).sort(sortEvents)
          const shown = evs.slice(0, 3)
          const extra = evs.length - shown.length
          return (
            <div
              key={ds}
              className={cn(
                'flex min-h-0 flex-col overflow-hidden border-r border-b p-[6px_7px]',
                inMonth ? 'bg-card' : 'bg-muted/40',
              )}
            >
              <div className="mb-0.5 flex justify-end">
                <span
                  className={cn(
                    'flex h-5.5 min-w-5.5 items-center justify-center rounded-full px-1.25 text-[12.5px] tabular-nums',
                    isToday
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : inMonth
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground/70 font-medium',
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className={cn('flex-1 overflow-hidden', !inMonth && 'opacity-50')}>
                {shown.map((ev) => (
                  <Chip key={ev.id} ev={ev} onClick={() => ctrl.openLesson(ev.lessonId)} />
                ))}
                {extra > 0 && (
                  <div className="text-muted-foreground mt-px pl-1.5 text-[10.5px] font-medium">
                    +{extra}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
