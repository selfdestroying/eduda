'use client'

import { cn } from '@/src/lib/utils'
import { fmtTime } from '../../lib/date-utils'
import type { CalendarEvent } from '../../types'

export function AgendaRow({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-stretch gap-3 px-[18px] py-2 text-left">
      <div className="text-muted-foreground w-[62px] flex-none pt-px text-[12.5px] font-medium tabular-nums">
        {fmtTime(ev.start)}
      </div>
      <div className="w-[3px] flex-none rounded-sm" style={{ background: ev.color }} />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'overflow-hidden text-[14.5px] font-semibold text-ellipsis whitespace-nowrap',
            ev.cancelled && 'text-muted-foreground line-through',
          )}
        >
          {ev.title}
        </div>
        <div className="text-muted-foreground mt-px truncate text-[12px]">
          {ev.location ? `${ev.location} · ${fmtTime(ev.end)}` : fmtTime(ev.end)}
        </div>
      </div>
    </button>
  )
}
