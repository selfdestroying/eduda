'use client'

import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import { DOW_FULL, MON_SHORT, NOW_COLOR } from '../../lib/constants'
import { addDays, sortEvents, startOfWeek, todayYmd, ymd } from '../../lib/date-utils'
import { AgendaRow } from './agenda-row'

export function MobileWeekView({ ctrl }: { ctrl: CalendarController }) {
  const s = startOfWeek(ctrl.curr, ctrl.weekStart)
  const days = Array.from({ length: 7 }, (_, i) => addDays(s, i))
  const today = todayYmd()

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-auto pb-28">
      {days.map((d) => {
        const ds = ymd(d)
        const evs = ctrl.eventsOn(ds).sort(sortEvents)
        const isToday = ds === today
        return (
          <div key={ds}>
            <div className="flex items-center gap-2 px-[18px] pt-4 pb-1.5">
              <span
                className={cn(
                  'text-[11px] font-semibold tracking-wide uppercase',
                  !isToday && 'text-muted-foreground',
                )}
                style={isToday ? { color: NOW_COLOR } : undefined}
              >
                {DOW_FULL[d.getDay()]}
              </span>
              <span
                className={cn('text-[11px] font-semibold', !isToday && 'text-muted-foreground/70')}
                style={isToday ? { color: NOW_COLOR } : undefined}
              >
                {MON_SHORT[d.getMonth()]} {d.getDate()}
              </span>
              {isToday && (
                <span
                  className="rounded-[5px] px-1.5 py-px text-[10px] font-semibold"
                  style={{ color: NOW_COLOR, background: 'rgba(239,68,68,0.1)' }}
                >
                  Сегодня
                </span>
              )}
            </div>
            {evs.length > 0 ? (
              evs.map((ev) => (
                <AgendaRow key={ev.id} ev={ev} onClick={() => ctrl.openLesson(ev.lessonId)} />
              ))
            ) : (
              <div className="text-muted-foreground/70 px-[18px] pt-0.5 pb-1.5 text-[13px]">
                Нет событий
              </div>
            )}
            <div className="bg-border mx-[18px] mt-2.5 h-px" />
          </div>
        )
      })}
    </div>
  )
}
