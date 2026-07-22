'use client'

import { useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import type { CalendarEvent } from '../../types'
import { DAY_STATUS_COLORS, DOW_FULL, DOW_SHORT, MONTHS_GENITIVE } from '../../lib/constants'
import {
  dowOrder,
  eventMarkStatus,
  fmtTime,
  hexA,
  monthGrid,
  sortEvents,
  todayYmd,
  ymd,
} from '../../lib/date-utils'
import { ChevronDown } from 'lucide-react'

function Chip({ ev, onClick, tz }: { ev: CalendarEvent; onClick: () => void; tz: string }) {
  // Только красная точка: зелёная у каждого отмеченного урока — визуальный шум.
  const unmarked = eventMarkStatus(ev, tz) === 'unmarked'
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
      {unmarked && (
        <span
          className="size-[5px] flex-none rounded-full"
          style={{ background: DAY_STATUS_COLORS.unmarked }}
        />
      )}
      <span className="text-muted-foreground flex-none text-[10.5px] tabular-nums">
        {fmtTime(ev.start)}
      </span>
      <span className={cn('overflow-hidden text-ellipsis', ev.cancelled && 'line-through')}>
        {ev.title}
      </span>
    </div>
  )
}

/** «+N» с поповером, показывающим все уроки дня. */
function DayOverflow({
  day,
  evs,
  extra,
  onSelect,
  tz,
}: {
  day: Date
  evs: CalendarEvent[]
  extra: number
  onSelect: (ev: CalendarEvent) => void
  tz: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="text-muted-foreground hover:bg-muted hover:text-foreground mt-px flex cursor-pointer items-center gap-0.5 rounded-[5px] px-1.5 py-0.5 text-left text-[10.5px] font-medium">
        +{extra}
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 p-2">
        <div className="text-muted-foreground mb-1.5 px-1.5 text-[11px] font-semibold tracking-wide uppercase">
          {DOW_FULL[day.getDay()]}, {day.getDate()} {MONTHS_GENITIVE[day.getMonth()]}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {evs.map((ev) => (
            <Chip
              key={ev.id}
              ev={ev}
              tz={tz}
              onClick={() => {
                setOpen(false)
                onSelect(ev)
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function MonthView({ ctrl }: { ctrl: CalendarController }) {
  const c = ctrl.curr
  const m = c.getMonth()
  const cells = monthGrid(c.getFullYear(), m, ctrl.weekStart)
  const order = dowOrder(ctrl.weekStart)
  const today = todayYmd(ctrl.tz)

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
              <div
                className={cn('thin-scrollbar flex-1 overflow-y-auto', !inMonth && 'opacity-50')}
              >
                {shown.map((ev) => (
                  <Chip key={ev.id} ev={ev} tz={ctrl.tz} onClick={() => ctrl.selectEvent(ev)} />
                ))}
                {extra > 0 && (
                  <DayOverflow
                    day={day}
                    evs={evs}
                    extra={extra}
                    tz={ctrl.tz}
                    onSelect={(ev) => ctrl.selectEvent(ev)}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
