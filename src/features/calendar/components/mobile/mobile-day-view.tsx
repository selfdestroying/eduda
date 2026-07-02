'use client'

import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import { DAY_STATUS_COLORS, DOW_NARROW, HOUR_H_MOBILE as HM, NOW_COLOR } from '../../lib/constants'
import {
  addDays,
  fmtHour,
  fmtTime,
  hexA,
  nowMinutes,
  startOfWeek,
  todayYmd,
  ymd,
} from '../../lib/date-utils'
import { layout } from '../../lib/layout'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function WeekStrip({ ctrl }: { ctrl: CalendarController }) {
  const s = startOfWeek(ctrl.curr, ctrl.weekStart)
  const days = Array.from({ length: 7 }, (_, i) => addDays(s, i))
  const cur = ctrl.currentDate
  const today = todayYmd()

  return (
    <div className="flex flex-none gap-0.5 border-b px-2 pt-2.5 pb-3">
      {days.map((d) => {
        const ds = ymd(d)
        const selected = ds === cur
        const isToday = ds === today
        const hasEvents = ctrl.eventsOn(ds).length > 0
        const status = ctrl.dayStatus(ds)
        return (
          <button
            key={ds}
            onClick={() => ctrl.setCurrentDate(ds)}
            className="flex flex-1 flex-col items-center gap-1.5 py-0.5"
          >
            <span
              className={cn(
                'text-[11px] font-semibold',
                isToday ? 'text-foreground' : 'text-muted-foreground',
              )}
              style={isToday ? { color: NOW_COLOR } : undefined}
            >
              {DOW_NARROW[d.getDay()]}
            </span>
            <span
              className={cn(
                'flex size-[34px] items-center justify-center rounded-full text-[15px] font-semibold tabular-nums',
                selected && 'bg-primary text-primary-foreground',
              )}
              style={!selected && isToday ? { color: NOW_COLOR } : undefined}
            >
              {d.getDate()}
            </span>
            <span
              className="size-[5px] rounded-full"
              style={{
                background: hasEvents
                  ? status
                    ? DAY_STATUS_COLORS[status]
                    : 'var(--muted-foreground)'
                  : 'transparent',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

function MobileTimeline({ ctrl }: { ctrl: CalendarController }) {
  const ds = ctrl.currentDate
  const evs = ctrl.eventsOn(ds)
  const lay = layout(evs)
  const isToday = ds === todayYmd()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={(el) => {
          if (el && ctrl.consumeScroll()) el.scrollTop = 9 * HM
        }}
        className="min-h-0 flex-1 overflow-auto"
      >
        <div className="relative" style={{ height: 24 * HM + 40 }}>
          {HOURS.map((hr) => (
            <div
              key={hr}
              className="text-muted-foreground/70 absolute left-0 w-12 text-right text-[11px] tabular-nums"
              style={{ top: hr * HM - 7 }}
            >
              {hr === 0 ? '' : fmtHour(hr)}
            </div>
          ))}
          <div
            className="absolute top-0 right-2.5 left-[52px]"
            style={{
              height: 24 * HM,
              backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HM}px)`,
            }}
          >
            {evs.map((ev) => {
              const slot = lay[ev.id] ?? { lane: 0, lanes: 1 }
              const top = (ev.start / 60) * HM
              const height = Math.max(24, ((ev.end - ev.start) / 60) * HM - 2)
              const w = 100 / slot.lanes
              return (
                <div
                  key={ev.id}
                  onClick={() => ctrl.selectEvent(ev)}
                  className={cn(
                    'absolute overflow-hidden rounded-[7px] px-2.5 py-[5px]',
                    ev.cancelled && 'opacity-50',
                  )}
                  style={{
                    top,
                    height,
                    left: `calc(${slot.lane * w}% + 2px)`,
                    width: `calc(${w}% - 4px)`,
                    background: hexA(ev.color, 0.12),
                  }}
                >
                  <div
                    className={cn(
                      'overflow-hidden text-[12.5px] font-semibold text-ellipsis whitespace-nowrap',
                      ev.cancelled && 'line-through',
                    )}
                  >
                    {ev.title}
                  </div>
                  {height > 40 && (
                    <div className="text-muted-foreground mt-px text-[11px] tabular-nums">
                      {fmtTime(ev.start)} – {fmtTime(ev.end)}
                    </div>
                  )}
                </div>
              )
            })}

            {isToday && (
              <div
                className="pointer-events-none absolute right-0 left-0 z-3 h-0"
                style={{ top: (nowMinutes() / 60) * HM, borderTop: `2px solid ${NOW_COLOR}` }}
              >
                <div
                  className="absolute -top-1 -left-[5px] size-[9px] rounded-full"
                  style={{ background: NOW_COLOR }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MobileDayView({ ctrl }: { ctrl: CalendarController }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WeekStrip ctrl={ctrl} />
      <MobileTimeline ctrl={ctrl} />
    </div>
  )
}
