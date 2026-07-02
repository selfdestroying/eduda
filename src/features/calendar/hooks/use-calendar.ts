'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
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
import { deriveCategories, mapLessonsToEvents } from '../lib/lesson-mapping'
import type { CalendarEvent, CalendarView, DayStatus, FilterDimension, WeekStart } from '../types'

export interface UseCalendarOptions {
  defaultView?: CalendarView
  weekStart?: WeekStart
}

export function useCalendar({
  defaultView = 'month',
  weekStart = 'Monday',
}: UseCalendarOptions = {}) {
  const [view, setViewState] = useState<CalendarView>(defaultView)
  const [currentDate, setCurrentDate] = useState<string>(todayYmd())
  /**
   * Скрытые категории по измерениям (тип группы / курс / локация / преподаватель) —
   * фильтр боковой панели. По умолчанию видимы все.
   */
  const [hidden, setHidden] = useState<Record<FilterDimension, Set<number>>>(() => ({
    course: new Set(),
    location: new Set(),
    teacher: new Set(),
    groupType: new Set(),
  }))

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
  const courseCategories = useMemo(() => deriveCategories(events, 'course'), [events])
  const locationCategories = useMemo(() => deriveCategories(events, 'location'), [events])
  const teacherCategories = useMemo(() => deriveCategories(events, 'teacher'), [events])
  const groupTypeCategories = useMemo(() => deriveCategories(events, 'groupType'), [events])

  const visibleEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          !hidden.course.has(e.courseId) &&
          !hidden.location.has(e.locationId) &&
          !hidden.groupType.has(e.groupTypeId) &&
          // Преподаватель — много значений: урок виден, если без преподавателя
          // либо хотя бы один из его преподавателей не скрыт.
          (e.teachers.length === 0 || e.teachers.some((t) => !hidden.teacher.has(t.id))),
      ),
    [events, hidden],
  )
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
      if (ds > todayYmd()) return null
      const passed = eventsOn(ds).filter((e) => !e.cancelled && eventPassed(e))
      if (passed.length === 0) return null
      return passed.every((e) => e.allMarked) ? 'marked' : 'unmarked'
    },
    [eventsOn],
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

  const toggleCategory = useCallback((dim: FilterDimension, id: number) => {
    setHidden((prev) => {
      const next = new Set(prev[dim])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, [dim]: next }
    })
  }, [])

  const isCategoryActive = useCallback(
    (dim: FilterDimension, id: number) => !hidden[dim].has(id),
    [hidden],
  )

  const categoriesByDim = useMemo<Record<FilterDimension, typeof courseCategories>>(
    () => ({
      course: courseCategories,
      location: locationCategories,
      teacher: teacherCategories,
      groupType: groupTypeCategories,
    }),
    [courseCategories, locationCategories, teacherCategories, groupTypeCategories],
  )

  /** Все категории измерения активны (видимы)? */
  const allCategoriesActive = useCallback(
    (dim: FilterDimension) => categoriesByDim[dim].every((c) => !hidden[dim].has(c.id)),
    [categoriesByDim, hidden],
  )

  /** Применён ли хоть один фильтр (что-то скрыто) — для индикатора на мобильных. */
  const hasActiveFilters = useMemo(
    () =>
      hidden.course.size > 0 ||
      hidden.location.size > 0 ||
      hidden.teacher.size > 0 ||
      hidden.groupType.size > 0,
    [hidden],
  )

  /** Включить/выключить сразу все категории измерения (если все активны — скрыть все, иначе показать все). */
  const toggleAllCategories = useCallback(
    (dim: FilterDimension) => {
      setHidden((prev) => {
        const allActive = categoriesByDim[dim].every((c) => !prev[dim].has(c.id))
        return {
          ...prev,
          [dim]: allActive ? new Set(categoriesByDim[dim].map((c) => c.id)) : new Set<number>(),
        }
      })
    },
    [categoriesByDim],
  )

  /** Выбрать событие для показа подробностей. */
  const selectEvent = useCallback((event: CalendarEvent) => setSelectedEvent(event), [])
  /** Закрыть карточку подробностей. */
  const closeEvent = useCallback(() => setSelectedEvent(null), [])

  return {
    // настройки
    weekStart,
    // состояние
    view,
    currentDate,
    curr,
    // данные
    events,
    courseCategories,
    locationCategories,
    teacherCategories,
    groupTypeCategories,
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
    toggleCategory,
    isCategoryActive,
    allCategoriesActive,
    toggleAllCategories,
    hasActiveFilters,
    // подробности урока
    selectedEvent,
    selectEvent,
    closeEvent,
    // автопрокрутка таймлайна
    consumeScroll,
  }
}

export type CalendarController = ReturnType<typeof useCalendar>
