'use client'

import { useCallback, useMemo, useState } from 'react'
import { deriveCategories } from '../lib/lesson-mapping'
import type { CalendarCategory, FilterableEvent, FilterDimension } from '../types'

/** Подписи секций — они же имена включённых фильтров на кнопке. */
export const FILTER_DIMENSION_TITLES: Record<FilterDimension, string> = {
  groupType: 'Тип группы',
  course: 'Курсы',
  location: 'Локации',
  teacher: 'Преподаватели',
}

/** Все измерения фильтра в порядке отображения панели. */
export const ALL_FILTER_DIMENSIONS: FilterDimension[] = [
  'groupType',
  'course',
  'location',
  'teacher',
]

/**
 * Машинка фильтров по измерениям (тип группы / курс / локация / преподаватель):
 * состояние скрытых категорий, их подсчёт и предикат видимости события.
 *
 * Живёт отдельно от `useCalendar`, потому что читателей двое: календарь и старая
 * панель управления. Второй реализации быть не должно — панель фильтров
 * (`CalendarFilters`) рисуется по этому же контроллеру.
 *
 * `dimensions` — какие секции показывать: у панели управления нет типов групп,
 * и пустая секция «Тип группы» врала бы «нет уроков».
 */
export function useEventFilters(
  events: FilterableEvent[],
  dimensions: FilterDimension[] = ALL_FILTER_DIMENSIONS,
) {
  /** Скрытые категории по измерениям. По умолчанию видимы все. */
  const [hidden, setHidden] = useState<Record<FilterDimension, Set<number>>>(() => ({
    course: new Set(),
    location: new Set(),
    teacher: new Set(),
    groupType: new Set(),
  }))

  const courseCategories = useMemo(() => deriveCategories(events, 'course'), [events])
  const locationCategories = useMemo(() => deriveCategories(events, 'location'), [events])
  const teacherCategories = useMemo(() => deriveCategories(events, 'teacher'), [events])
  const groupTypeCategories = useMemo(() => deriveCategories(events, 'groupType'), [events])

  const categoriesByDim = useMemo<Record<FilterDimension, CalendarCategory[]>>(
    () => ({
      course: courseCategories,
      location: locationCategories,
      teacher: teacherCategories,
      groupType: groupTypeCategories,
    }),
    [courseCategories, locationCategories, teacherCategories, groupTypeCategories],
  )

  /** Событие проходит фильтры всех измерений. */
  const isVisible = useCallback(
    (e: FilterableEvent) =>
      !hidden.course.has(e.courseId) &&
      !hidden.location.has(e.locationId) &&
      !hidden.groupType.has(e.groupTypeId) &&
      // Преподаватель — много значений: урок виден, если без преподавателя
      // либо хотя бы один из его преподавателей не скрыт.
      (e.teachers.length === 0 || e.teachers.some((t) => !hidden.teacher.has(t.id))),
    [hidden],
  )

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

  /** Все категории измерения активны (видимы)? */
  const allCategoriesActive = useCallback(
    (dim: FilterDimension) => categoriesByDim[dim].every((c) => !hidden[dim].has(c.id)),
    [categoriesByDim, hidden],
  )

  /**
   * Имена измерений, по которым что-то скрыто. Панель закрыта, и счётчик «2» не
   * говорит, по чему отобрано, — поэтому кнопка называет фильтры поимённо, как в
   * тулбаре таблиц.
   */
  const activeTitles = useMemo(
    () =>
      dimensions.filter((dim) => hidden[dim].size > 0).map((dim) => FILTER_DIMENSION_TITLES[dim]),
    [dimensions, hidden],
  )

  /** Применён ли хоть один фильтр (что-то скрыто) — для индикатора на кнопке. */
  const hasActiveFilters = activeTitles.length > 0

  /** Показать всё: сброс всех измерений разом. */
  const reset = useCallback(
    () =>
      setHidden({
        course: new Set(),
        location: new Set(),
        teacher: new Set(),
        groupType: new Set(),
      }),
    [],
  )

  /** Включить/выключить сразу все категории измерения (все активны — скрыть все, иначе показать все). */
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

  return {
    dimensions,
    courseCategories,
    locationCategories,
    teacherCategories,
    groupTypeCategories,
    categoriesByDim,
    isVisible,
    toggleCategory,
    isCategoryActive,
    allCategoriesActive,
    toggleAllCategories,
    hasActiveFilters,
    activeTitles,
    reset,
  }
}

export type EventFiltersController = ReturnType<typeof useEventFilters>
