'use client'

import { cn } from '@/src/lib/utils'
import { useEffect, useMemo, useRef } from 'react'
import type { CalendarController } from '../hooks/use-calendar'
import { DAY_STATUS_COLORS, DOW_FULL, MON_SHORT, NOW_COLOR } from '../lib/constants'
import { parseYmd, sortEvents, todayYmd } from '../lib/date-utils'
import { AgendaRow } from './mobile/agenda-row'

export function ListView({ ctrl }: { ctrl: CalendarController }) {
  const today = todayYmd(ctrl.tz)
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

  const containerRef = useRef<HTMLDivElement>(null)
  /** Дата, до которой список уже прокручен, — чтобы не прыгать при смене фильтров. */
  const scrolledTo = useRef<string | null>(null)

  // Прокрутка к выбранной дате (мини-календарь / «Сегодня»); при открытии — к текущей.
  useEffect(() => {
    if (scrolledTo.current === ctrl.currentDate) return
    const el = containerRef.current
    if (!el) return
    // Пока месяц грузится, показываются данные предыдущего (keepPreviousData) — ждём свои.
    const monthKey = ctrl.currentDate.slice(0, 7)
    if (!sections.some((s) => s.ds.startsWith(monthKey))) return
    // Точной даты может не быть (нет уроков) — ближайшая следующая, иначе последняя.
    const target = sections.find((s) => s.ds >= ctrl.currentDate) ?? sections.at(-1)
    const node = target && el.querySelector<HTMLElement>(`[data-date="${target.ds}"]`)
    if (!node) return
    const top = node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
    el.scrollTo({ top, behavior: scrolledTo.current === null ? 'auto' : 'smooth' })
    scrolledTo.current = ctrl.currentDate
  }, [ctrl.currentDate, sections])

  if (sections.length === 0) {
    return (
      <div className="text-muted-foreground/70 flex min-h-0 flex-1 items-center justify-center p-6 text-[13.5px]">
        Нет уроков в этом месяце
      </div>
    )
  }

  return (
    <div ref={containerRef} className="thin-scrollbar min-h-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-190 py-1">
        {sections.map((section) => {
          const isToday = section.ds === today
          const d = section.date
          const status = ctrl.dayStatus(section.ds)
          return (
            <section key={section.ds} data-date={section.ds}>
              <div className="bg-card/95 sticky top-0 z-1 flex items-center gap-2 px-4.5 pt-4 pb-1.5 backdrop-blur">
                {status && (
                  <span
                    className="size-[5px] flex-none rounded-full"
                    style={{ background: DAY_STATUS_COLORS[status] }}
                  />
                )}
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
                    style={{ color: NOW_COLOR, background: 'oklch(0.541 0.281 293.009 / 10%)' }}
                  >
                    Сегодня
                  </span>
                )}
              </div>
              {section.events.map((ev) => (
                <AgendaRow key={ev.id} ev={ev} tz={ctrl.tz} onClick={() => ctrl.selectEvent(ev)} />
              ))}
              <div className="bg-border mx-4.5 mt-2.5 h-px" />
            </section>
          )
        })}
      </div>
    </div>
  )
}
