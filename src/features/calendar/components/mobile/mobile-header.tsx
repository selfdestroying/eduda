'use client'

import { Button } from '@/src/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarController } from '../../hooks/use-calendar'
import { getMobilePeriod } from '../../lib/period'
import { FiltersDrawer } from '../filters-drawer'
import { ViewTabs } from '../view-tabs'

export function MobileHeader({ ctrl }: { ctrl: CalendarController }) {
  const { title, sub } = getMobilePeriod({
    curr: ctrl.curr,
    view: ctrl.view,
    weekStart: ctrl.weekStart,
    eventCount: ctrl.visibleEvents.length,
  })

  return (
    <header className="flex-none border-b px-4 pt-4">
      <div className="mb-3.5 flex items-end justify-between gap-2.5">
        <div className="min-w-0">
          <div className="truncate text-[23px] leading-[1.1] font-bold tracking-tight">{title}</div>
          <div className="text-muted-foreground mt-0.5 text-[13px]">{sub}</div>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={() => ctrl.nav(-1)} aria-label="Назад">
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={ctrl.goToday}>
            Сегодня
          </Button>
          <Button variant="outline" size="icon" onClick={() => ctrl.nav(1)} aria-label="Вперёд">
            <ChevronRight />
          </Button>
          <FiltersDrawer ctrl={ctrl} />
        </div>
      </div>
      <div className="flex items-center gap-2 pb-3">
        <div className="min-w-0 flex-1">
          <ViewTabs view={ctrl.view} onChange={ctrl.setView} fullWidth />
        </div>
      </div>
    </header>
  )
}
