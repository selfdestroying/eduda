'use client'

import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../../hooks/use-calendar'
import { hexA } from '../../lib/date-utils'
import { MiniMonth } from './mini-month'

export function CalendarSidebar({ ctrl }: { ctrl: CalendarController }) {
  const todayNum = new Date().getDate()

  return (
    <aside className="hidden w-[264px] flex-none flex-col gap-5 overflow-hidden border-r p-4 lg:flex">
      <div className="flex items-center gap-2.5 px-1">
        <div className="bg-primary text-primary-foreground flex size-[30px] items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums">
          {todayNum}
        </div>
        <span className="text-[15px] font-semibold tracking-tight">Календарь</span>
      </div>

      <MiniMonth ctrl={ctrl} />

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="text-muted-foreground mb-2 px-2 text-[11px] font-semibold tracking-wide uppercase">
          Курсы
        </div>
        {ctrl.categories.length === 0 ? (
          <div className="text-muted-foreground/70 px-2 text-[12.5px]">Нет уроков</div>
        ) : (
          ctrl.categories.map((cat) => {
            const active = ctrl.isCategoryActive(cat.id)
            return (
              <button
                key={cat.id}
                onClick={() => ctrl.toggleCategory(cat.id)}
                className={cn(
                  'hover:bg-muted flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground/70',
                )}
              >
                <span
                  className="size-[11px] flex-none rounded-[3px] border-[1.5px]"
                  style={{
                    background: active ? cat.color : 'transparent',
                    borderColor: active ? cat.color : hexA(cat.color, 0.5),
                  }}
                />
                <span className="flex-1 truncate text-left">{cat.name}</span>
                <span className="text-muted-foreground bg-muted rounded-[5px] px-1.5 py-px text-[11px] font-medium tabular-nums">
                  {cat.count}
                </span>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
