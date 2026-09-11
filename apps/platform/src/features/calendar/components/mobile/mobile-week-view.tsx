'use client'

import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import { DAY_STATUS_COLORS, DOW_FULL, MON_SHORT, NOW_COLOR } from '../../lib/constants'
import { addDays, sortEvents, startOfWeek, todayYmd, withAlpha, ymd } from '../../lib/date-utils'
import { AgendaRow } from './agenda-row'

export function MobileWeekView({ ctrl }: { ctrl: CalendarController }) {
  const s = startOfWeek(ctrl.curr, ctrl.weekStart)
  const days = Array.from({ length: 7 }, (_, i) => addDays(s, i))
  const today = todayYmd(ctrl.tz)

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-auto pb-28">
      {days.map((d) => {
        const ds = ymd(d)
        const evs = ctrl.eventsOn(ds).sort(sortEvents)
        const isToday = ds === today
        const status = ctrl.dayStatus(ds)
        return (
          <div key={ds}>
            <div className="flex items-center gap-2 px-4.5 pt-4 pb-1.5">
              {status && (
                <span
                  className="size-1.25 flex-none rounded-full"
                  style={{ background: DAY_STATUS_COLORS[status] }}
                />
              )}
              <span
                className={cn(
                  'text-xs font-semibold tracking-wide uppercase',
                  !isToday && 'text-muted-foreground',
                )}
                style={isToday ? { color: NOW_COLOR } : undefined}
              >
                {DOW_FULL[d.getDay()]}
              </span>
              <span
                className={cn('text-xs font-semibold', !isToday && 'text-muted-foreground/70')}
                style={isToday ? { color: NOW_COLOR } : undefined}
              >
                {MON_SHORT[d.getMonth()]} {d.getDate()}
              </span>
              {isToday && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ color: NOW_COLOR, background: withAlpha(NOW_COLOR, 0.1) }}
                >
                  Сегодня
                </span>
              )}
            </div>
            {evs.length > 0 ? (
              evs.map((ev) => (
                <AgendaRow key={ev.id} ev={ev} tz={ctrl.tz} onClick={() => ctrl.selectEvent(ev)} />
              ))
            ) : (
              <div className="text-muted-foreground/70 px-4.5 pt-0.5 pb-1.5 text-sm">
                Нет событий
              </div>
            )}
            <div className="bg-border mx-4.5 mt-2.5 h-px" />
          </div>
        )
      })}
    </div>
  )
}
