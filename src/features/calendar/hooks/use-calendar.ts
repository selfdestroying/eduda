'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useCalendarLessonsQuery } from '../queries'
import { addDays, addMonths, parseYmd, todayYmd, visibleRange, ymd } from '../lib/date-utils'
import { deriveCategories, mapLessonsToEvents } from '../lib/lesson-mapping'
import type { CalendarView, WeekStart } from '../types'

export interface UseCalendarOptions {
  defaultView?: CalendarView
  weekStart?: WeekStart
}

export function useCalendar({
  defaultView = 'month',
  weekStart = 'Monday',
}: UseCalendarOptions = {}) {
  const router = useRouter()
  const [view, setViewState] = useState<CalendarView>(defaultView)
  const [currentDate, setCurrentDate] = useState<string>(todayYmd())
  /** Скрытые курсы (фильтр боковой панели). По умолчанию видимы все. */
  const [hidden, setHidden] = useState<Set<number>>(() => new Set())

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
  const categories = useMemo(() => deriveCategories(events), [events])

  const visibleEvents = useMemo(
    () => events.filter((e) => !hidden.has(e.courseId)),
    [events, hidden],
  )
  const eventsOn = useCallback(
    (ds: string) => visibleEvents.filter((e) => e.date === ds),
    [visibleEvents],
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
    setCurrentDate(todayYmd())
  }, [requestScroll])

  const shiftMiniMonth = useCallback((n: number) => {
    setCurrentDate((cd) => ymd(addMonths(parseYmd(cd), n)))
  }, [])

  const toggleCategory = useCallback((id: number) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const isCategoryActive = useCallback((id: number) => !hidden.has(id), [hidden])

  /** Открыть страницу урока. */
  const openLesson = useCallback(
    (lessonId: number) => router.push(`/lessons/${lessonId}`),
    [router],
  )

  return {
    // настройки
    weekStart,
    // состояние
    view,
    currentDate,
    curr,
    // данные
    events,
    categories,
    visibleEvents,
    eventsOn,
    isLoading,
    isFetching,
    // навигация
    setView,
    nav,
    goToday,
    shiftMiniMonth,
    setCurrentDate,
    // фильтр курсов
    toggleCategory,
    isCategoryActive,
    // переход к уроку
    openLesson,
    // автопрокрутка таймлайна
    consumeScroll,
  }
}

export type CalendarController = ReturnType<typeof useCalendar>
