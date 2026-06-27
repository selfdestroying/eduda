'use client'

import { Button } from '@/src/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarController } from '../../hooks/use-calendar'
import { getDesktopPeriod } from '../../lib/period'
import { ViewTabs } from '../view-tabs'

export function CalendarHeader({ ctrl }: { ctrl: CalendarController }) {
  const { title, sub } = getDesktopPeriod({
    curr: ctrl.curr,
    view: ctrl.view,
    weekStart: ctrl.weekStart,
    eventCount: ctrl.visibleEvents.length,
  })

  return (
    <header className="flex h-16 flex-none items-center justify-between gap-4 border-b px-6">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="truncate text-[22px] leading-none font-semibold tracking-tight">{title}</h1>
        <span className="text-muted-foreground shrink-0 text-[13.5px]">{sub}</span>
      </div>

      <div className="flex flex-none items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-lg" onClick={() => ctrl.nav(-1)} aria-label="Назад">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="lg" onClick={ctrl.goToday}>
            Сегодня
          </Button>
          <Button variant="outline" size="icon-lg" onClick={() => ctrl.nav(1)} aria-label="Вперёд">
            <ChevronRight />
          </Button>
        </div>
        <ViewTabs view={ctrl.view} onChange={ctrl.setView} />
      </div>
    </header>
  )
}
