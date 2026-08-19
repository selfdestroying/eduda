'use client'

import { ScrollArea } from '@repo/ui/components/scroll-area'
import type { CalendarController } from '../../hooks/use-calendar'
import { CalendarFilters } from '../calendar-filters'
import { MiniMonth } from './mini-month'

export function CalendarSidebar({ ctrl }: { ctrl: CalendarController }) {
  const todayNum = new Date().getDate()

  return (
    <aside className="hidden w-66 flex-none flex-col gap-5 overflow-hidden border-r p-4 lg:flex">
      <div className="flex items-center gap-2.5 px-1">
        <div className="bg-primary text-primary-foreground flex size-7.5 items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums">
          {todayNum}
        </div>
        <span className="text-[15px] font-semibold tracking-tight">Календарь</span>
      </div>

      <MiniMonth ctrl={ctrl} />

      <ScrollArea className="min-h-0 flex-1">
        <CalendarFilters ctrl={ctrl} />
      </ScrollArea>
    </aside>
  )
}
