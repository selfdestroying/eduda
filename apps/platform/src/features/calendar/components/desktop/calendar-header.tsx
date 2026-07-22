'use client'

import { Button } from '@/src/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarController } from '../../hooks/use-calendar'
import { getDesktopPeriod } from '../../lib/period'
import { ClassicViewButton } from '../classic-view-button'
import { FiltersDrawer } from '../filters-drawer'
import { ViewTabs } from '../view-tabs'

export function CalendarHeader({ ctrl }: { ctrl: CalendarController }) {
  const { title, sub } = getDesktopPeriod({
    curr: ctrl.curr,
    view: ctrl.view,
    weekStart: ctrl.weekStart,
    eventCount: ctrl.visibleEvents.length,
  })

  return (
    <header className="flex h-16 flex-none items-center justify-between gap-4 border-b px-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="truncate text-[22px] leading-none font-semibold tracking-tight">{title}</h1>
        <span className="text-muted-foreground shrink-0 text-[13.5px]">{sub}</span>
      </div>

      <div className="flex flex-none items-center gap-2.5">
        <ClassicViewButton />
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size={'icon'} onClick={() => ctrl.nav(-1)} aria-label="Назад">
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={ctrl.goToday}>
            Сегодня
          </Button>
          <Button variant="outline" size={'icon'} onClick={() => ctrl.nav(1)} aria-label="Вперёд">
            <ChevronRight />
          </Button>
        </div>
        <ViewTabs view={ctrl.view} onChange={ctrl.setView} />
        {/* Боковая панель с триггером фильтров есть только ≥ lg — ниже даём кнопку в шапке. */}
        <div className="lg:hidden">
          <FiltersDrawer ctrl={ctrl} />
        </div>
      </div>
    </header>
  )
}
