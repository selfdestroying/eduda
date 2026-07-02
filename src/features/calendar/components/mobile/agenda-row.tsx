'use client'

import { cn } from '@/src/lib/utils'
import { DAY_STATUS_COLORS } from '../../lib/constants'
import { eventMarkStatus, fmtTime, hexA } from '../../lib/date-utils'
import type { CalendarEvent } from '../../types'

export function AgendaRow({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  const unmarked = eventMarkStatus(ev) === 'unmarked'
  return (
    <button onClick={onClick} className="flex w-full items-stretch gap-3 px-[18px] py-2 text-left">
      <div className="text-muted-foreground w-[62px] flex-none pt-px text-[12.5px] font-medium tabular-nums">
        {fmtTime(ev.start)}
      </div>
      <div className="w-[3px] flex-none rounded-sm" style={{ background: ev.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-[14.5px] font-semibold',
              ev.cancelled && 'text-muted-foreground line-through',
            )}
          >
            {ev.title}
          </span>
          {unmarked && (
            <span
              className="flex-none rounded-[5px] px-1.5 py-px text-[10px] font-semibold"
              style={{
                color: DAY_STATUS_COLORS.unmarked,
                background: hexA(DAY_STATUS_COLORS.unmarked, 0.1),
              }}
            >
              Не отмечено
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-px truncate text-[12px]">
          {ev.location ? `${ev.location} · ${fmtTime(ev.end)}` : fmtTime(ev.end)}
        </div>
      </div>
    </button>
  )
}
