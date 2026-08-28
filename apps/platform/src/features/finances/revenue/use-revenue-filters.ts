'use client'

import { filterIds, useTableState } from '@/src/hooks/use-table-state'
import { useMemo } from 'react'
import type { RevenueChartSchemaType } from './schemas'

/**
 * Один id на график и таблицу: отбор у них общий, а по этому ключу в
 * `localStorage` лежит видимость колонок. Таблица выручки на странице одна,
 * поэтому id живёт здесь, а не приезжает пропсом.
 */
export const REVENUE_TABLE_ID = 'revenue'

/** Колонки с отбором. Всё строками: значения приходят из адресной строки. */
const TABLE_FILTERS = {
  course: 'string',
  teacher: 'string',
  location: 'string',
} as const

/**
 * Отбор, общий для таблицы выручки и графика над ней: период, курс,
 * преподаватель, локация, поиск. Страницы и порядка здесь нет — графику они не
 * нужны, он берёт всю выборку целиком.
 *
 * Хук зовут оба компонента, каждый сам, и видят они одно и то же: состояние
 * живёт в адресной строке, а не в React. Сводить их через общего родителя —
 * тащить состояние таблицы на страницу и раздавать пропами — незачем.
 */
export function useRevenueFilters() {
  const t = useTableState({ id: REVENUE_TABLE_ID, filters: TABLE_FILTERS })
  const { columnFilters, period } = t

  const filters: RevenueChartSchemaType = useMemo(
    () => ({
      search: t.search,
      from: period.from ?? undefined,
      to: period.to ?? undefined,
      courseIds: filterIds(columnFilters, 'course'),
      teacherIds: filterIds(columnFilters, 'teacher'),
      locationIds: filterIds(columnFilters, 'location'),
    }),
    [t.search, period, columnFilters],
  )

  return { t, filters }
}
