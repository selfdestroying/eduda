'use client'

import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import {
  DAY_STATUS_COLORS,
  DOW_SHORT,
  HOUR_H_DESKTOP as HOUR_H,
  NOW_COLOR,
} from '../../lib/constants'
import {
  eventMarkStatus,
  fmtHour,
  fmtTime,
  hexA,
  nowMinutes,
  todayYmd,
  ymd,
} from '../../lib/date-utils'
import { layout } from '../../lib/layout'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function DayColumn({ ctrl, day }: { ctrl: CalendarController; day: Date }) {
  const ds = ymd(day)
  const evs = ctrl.eventsOn(ds)
  const lay = layout(evs)
  const isToday = ds === todayYmd(ctrl.tz)

  return (
    <div
      className="relative min-w-0 flex-1 border-l"
      style={{
        backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HOUR_H}px)`,
      }}
    >
      {evs.map((ev) => {
        const slot = lay[ev.id] ?? { lane: 0, lanes: 1 }
        const top = (ev.start / 60) * HOUR_H
        const height = Math.max(20, ((ev.end - ev.start) / 60) * HOUR_H - 2)
        const w = 100 / slot.lanes
        const unmarked = eventMarkStatus(ev, ctrl.tz) === 'unmarked'
        return (
          <div
            key={ev.id}
            onClick={() => ctrl.selectEvent(ev)}
            className={cn(
              'absolute z-1 cursor-pointer overflow-hidden rounded-md px-1.75 py-0.75',
              ev.cancelled && 'opacity-50',
            )}
            style={{
              top,
              height,
              left: `calc(${slot.lane * w}% + 2px)`,
              width: `calc(${w}% - 4px)`,
              background: hexA(ev.color, 0.2),
            }}
          >
            <div className="flex items-center gap-1">
              {unmarked && (
                <span
                  className="size-[5px] flex-none rounded-full"
                  style={{ background: DAY_STATUS_COLORS.unmarked }}
                />
              )}
              <span
                className={cn(
                  'truncate text-[11.5px] leading-[1.25] font-semibold',
                  ev.cancelled && 'line-through',
                )}
              >
                {ev.title}
              </span>
            </div>
            {height > 34 && (
              <div className="text-muted-foreground mt-px text-[10.5px] tabular-nums">
                {fmtTime(ev.start)} – {fmtTime(ev.end)}
              </div>
            )}
          </div>
        )
      })}

      {isToday && (
        <div
          className="pointer-events-none absolute right-0 left-0 z-3 h-0"
          style={{ top: (nowMinutes(ctrl.tz) / 60) * HOUR_H, borderTop: `2px solid ${NOW_COLOR}` }}
        >
          <div
            className="absolute -top-1 -left-1 size-2 rounded-full"
            style={{ background: NOW_COLOR }}
          />
        </div>
      )}
    </div>
  )
}

export function Timeline({ ctrl, days }: { ctrl: CalendarController; days: Date[] }) {
  const isWeek = days.length > 1
  const today = todayYmd(ctrl.tz)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Шапка с днями */}
      <div className="bg-muted/40 flex flex-none border-b">
        <div className="w-[60px] flex-none" />
        {days.map((day) => {
          const isToday = ymd(day) === today
          return (
            <div key={ymd(day)} className="min-w-0 flex-1 border-l px-1 pt-2.5 pb-3 text-center">
              <div
                className={cn(
                  'text-[11px] font-semibold tracking-wide uppercase',
                  isToday ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {DOW_SHORT[day.getDay()]}
              </div>
              <div
                className={cn(
                  'mx-auto mt-1 rounded-full font-semibold tabular-nums',
                  isWeek
                    ? 'size-8 text-[17px] leading-8'
                    : 'size-[38px] text-[21px] leading-[38px]',
                  isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                )}
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Прокручиваемое тело */}
      <div
        ref={(el) => {
          if (el && ctrl.consumeScroll()) el.scrollTop = 9 * HOUR_H
        }}
        className="no-scrollbar min-h-0 flex-1 overflow-auto"
      >
        <div className="relative flex" style={{ height: 24 * HOUR_H }}>
          <div className="relative w-[60px] flex-none">
            {HOURS.map((hr) => (
              <div
                key={hr}
                className="text-muted-foreground/70 absolute right-2.5 text-[10.5px] tabular-nums"
                style={{ top: hr * HOUR_H - 6 }}
              >
                {hr === 0 ? '' : fmtHour(hr)}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn key={ymd(day)} ctrl={ctrl} day={day} />
          ))}
        </div>
      </div>
    </div>
  )
}
