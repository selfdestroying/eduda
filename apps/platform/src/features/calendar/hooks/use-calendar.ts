'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { useCalendarLessonsQuery } from '../queries'
import {
  addDays,
  addMonths,
  eventPassed,
  parseYmd,
  todayYmd,
  visibleRange,
  ymd,
} from '../lib/date-utils'
import { mapLessonsToEvents } from '../lib/lesson-mapping'
import type { CalendarEvent, CalendarView, DayStatus, WeekStart } from '../types'
import { useEventFilters } from './use-event-filters'

export interface UseCalendarOptions {
  defaultView?: CalendarView
  weekStart?: WeekStart
}

export function useCalendar({
  defaultView = 'month',
  weekStart = 'Monday',
}: UseCalendarOptions = {}) {
  const tz = useOrgTimezone()
  const [view, setViewState] = useState<CalendarView>(defaultView)
  // Начальное значение — по браузерному TZ; при позднем приходе tz не пересчитывается,
  // но `goToday` самовосстанавливается по поясу организации.
  const [currentDate, setCurrentDate] = useState<string>(todayYmd())

  /** Событие, выбранное для просмотра подробностей (показ в drawer'е). */
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  /** Одноразовый флаг автопрокрутки таймлайна к 7:00. */
  const needsScroll = useRef(true)
  const requestScroll = useCallback(() => {
    needsScroll.current = true
  }, [])
  const consumeScroll = useCallback(() => {
    if (needsScroll.current) {
      needsScroll.current = false
      return true
    }
    return false
  }, [])

  const curr = useMemo(() => parseYmd(currentDate), [currentDate])

  // ─── Загрузка уроков за видимый диапазон ───────────────────────────────────
  const range = useMemo(() => visibleRange(view, curr, weekStart), [view, curr, weekStart])
  const { data, isLoading, isFetching } = useCalendarLessonsQuery(range.from, range.to)
  const events = useMemo(() => mapLessonsToEvents(data ?? []), [data])
  // Фильтры (тип группы / курс / локация / преподаватель) — общая машинка с панелью
  // управления, см. `useEventFilters`.
  const filters = useEventFilters(events)
  const visibleEvents = useMemo(() => events.filter(filters.isVisible), [events, filters.isVisible])
  const eventsOn = useCallback(
    (ds: string) => visibleEvents.filter((e) => e.date === ds),
    [visibleEvents],
  )

  /**
   * Статус отметки посещаемости за день: зелёная/красная точка под датой.
   * Считается только по прошедшим урокам (для «сегодня» — по уже закончившимся),
   * отменённые не учитываются; `null` — статуса нет (будущий день / нет уроков).
   */
  const dayStatus = useCallback(
    (ds: string): DayStatus | null => {
      if (ds > todayYmd(tz)) return null
      const passed = eventsOn(ds).filter((e) => !e.cancelled && eventPassed(e, tz))
      if (passed.length === 0) return null
      return passed.every((e) => e.allMarked) ? 'marked' : 'unmarked'
    },
    [eventsOn, tz],
  )

  // ─── Навигация ─────────────────────────────────────────────────────────────
  const setView = useCallback(
    (v: CalendarView) => {
      requestScroll()
      setViewState(v)
    },
    [requestScroll],
  )

  const nav = useCallback(
    (dir: number) => {
      setCurrentDate((cd) => {
        const c = parseYmd(cd)
        if (view === 'day') return ymd(addDays(c, dir))
        if (view === 'week') return ymd(addDays(c, dir * 7))
        if (view === 'month' || view === 'list') return ymd(addMonths(c, dir))
        return ymd(addMonths(c, dir * 12))
      })
    },
    [view],
  )

  const goToday = useCallback(() => {
    requestScroll()
    setCurrentDate(todayYmd(tz))
  }, [requestScroll, tz])

  const shiftMiniMonth = useCallback((n: number) => {
    setCurrentDate((cd) => ymd(addMonths(parseYmd(cd), n)))
  }, [])

  /** Выбрать событие для показа подробностей. */
  const selectEvent = useCallback((event: CalendarEvent) => setSelectedEvent(event), [])
  /** Закрыть карточку подробностей. */
  const closeEvent = useCallback(() => setSelectedEvent(null), [])

  return {
    // настройки
    weekStart,
    tz,
    // состояние
    view,
    currentDate,
    curr,
    // данные
    events,
    visibleEvents,
    eventsOn,
    dayStatus,
    isLoading,
    isFetching,
    // навигация
    setView,
    nav,
    goToday,
    shiftMiniMonth,
    setCurrentDate,
    // фильтры (тип группы / курс / локация / преподаватель)
    ...filters,
    // подробности урока
    selectedEvent,
    selectEvent,
    closeEvent,
    // автопрокрутка таймлайна
    consumeScroll,
  }
}

export type CalendarController = ReturnType<typeof useCalendar>
