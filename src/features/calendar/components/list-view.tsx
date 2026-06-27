'use client'

import { cn } from '@/src/lib/utils'
import { useMemo } from 'react'
import type { CalendarController } from '../hooks/use-calendar'
import { DOW_FULL, MON_SHORT, NOW_COLOR } from '../lib/constants'
import { parseYmd, sortEvents, todayYmd } from '../lib/date-utils'
import { AgendaRow } from './mobile/agenda-row'

export function ListView({ ctrl }: { ctrl: CalendarController }) {
  const today = todayYmd()
  const { visibleEvents } = ctrl

  // Группировка уроков по дням (только дни, где есть уроки).
  const sections = useMemo(() => {
    const map = new Map<string, typeof visibleEvents>()
    for (const e of visibleEvents) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ds, evs]) => ({ ds, date: parseYmd(ds), events: [...evs].sort(sortEvents) }))
  }, [visibleEvents])

  if (sections.length === 0) {
    return (
      <div className="text-muted-foreground/70 flex min-h-0 flex-1 items-center justify-center p-6 text-[13.5px]">
        Нет уроков в этом месяце
      </div>
    )
  }

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-[760px] py-1">
        {sections.map((section) => {
          const isToday = section.ds === today
          const d = section.date
          return (
            <section key={section.ds}>
              <div className="bg-card/95 sticky top-0 z-1 flex items-center gap-2 px-[18px] pt-4 pb-1.5 backdrop-blur">
                <span
                  className={cn(
                    'text-[11px] font-semibold tracking-wide uppercase',
                    !isToday && 'text-muted-foreground',
                  )}
                  style={isToday ? { color: NOW_COLOR } : undefined}
                >
                  {DOW_FULL[d.getDay()]}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    !isToday && 'text-muted-foreground/70',
                  )}
                  style={isToday ? { color: NOW_COLOR } : undefined}
                >
                  {d.getDate()} {MON_SHORT[d.getMonth()]}
                </span>
                {isToday && (
                  <span
                    className="rounded-[5px] px-1.5 py-px text-[10px] font-semibold"
                    style={{ color: NOW_COLOR, background: 'rgba(239,68,68,0.1)' }}
                  >
                    Сегодня
                  </span>
                )}
              </div>
              {section.events.map((ev) => (
                <AgendaRow key={ev.id} ev={ev} onClick={() => ctrl.openLesson(ev.lessonId)} />
              ))}
              <div className="bg-border mx-[18px] mt-2.5 h-px" />
            </section>
          )
        })}
      </div>
    </div>
  )
}
