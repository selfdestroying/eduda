'use client'

import { cn } from '@/src/lib/utils'
import { DAY_STATUS_COLORS } from '../../lib/constants'
import { eventMarkStatus, fmtTime, withAlpha } from '../../lib/date-utils'
import type { CalendarEvent } from '../../types'

export function AgendaRow({
  ev,
  onClick,
  tz,
}: {
  ev: CalendarEvent
  onClick: () => void
  tz: string
}) {
  const unmarked = eventMarkStatus(ev, tz) === 'unmarked'
  return (
    <button onClick={onClick} className="flex w-full items-stretch gap-3 px-4.5 py-2 text-left">
      <div className="text-muted-foreground w-15.5 flex-none pt-px text-xs font-medium tabular-nums">
        {fmtTime(ev.start)}
      </div>
      <div className="w-0.75 flex-none rounded-sm" style={{ background: ev.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-sm font-semibold',
              ev.cancelled && 'text-muted-foreground line-through',
            )}
          >
            {ev.title}
          </span>
          {unmarked && (
            <span
              className="flex-none rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                color: DAY_STATUS_COLORS.unmarked,
                background: withAlpha(DAY_STATUS_COLORS.unmarked, 0.1),
              }}
            >
              Не отмечено
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-px truncate text-xs">
          {ev.location ? `${ev.location} · ${fmtTime(ev.end)}` : fmtTime(ev.end)}
        </div>
      </div>
    </button>
  )
}
