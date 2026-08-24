'use client'

import { filterIds, filterValues, useTableState } from '@/src/hooks/use-table-state'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { useMemo } from 'react'
import type { AbsentChartSchemaType } from './schemas'

/**
 * Колонки, по которым фильтруем: `useTableState` держит их в URL, а отсюда они
 * уезжают в запрос. Всё строками, включая id, — значения приходят из адреса, и в
 * числа их превращает уже сборка параметров запроса.
 */
const TABLE_FILTERS = {
  course: 'string',
  location: 'string',
  teacher: 'string',
  warned: 'string',
  makeup: 'string',
} as const

/**
 * Галочки «Да»/«Нет» — в признак для запроса. Обе или ни одной значат «не
 * фильтруем»: отбор, которому удовлетворяют все строки, дешевле не отправлять
 * вовсе. Мусор из адресной строки сюда же — он не совпадёт ни с `yes`, ни с `no`.
 */
function flagFilter(columnFilters: ColumnFiltersState, id: string): boolean | undefined {
  const values = filterValues(columnFilters, id)
  const yes = values.includes('yes')
  const no = values.includes('no')
  return yes === no ? undefined : yes
}

/**
 * Отбор, общий для таблицы и графика: период, курс, локация, преподаватель,
 * поиск. Страницы и порядка здесь нет — графику они не нужны, а с ними он
 * перезапрашивался бы на каждый клик по пагинации.
 *
 * Хук зовут оба компонента, каждый сам, и видят они одно и то же: состояние живёт
 * в адресной строке, а не в React. Поэтому сводить их через общего родителя —
 * тащить состояние таблицы на страницу и раздавать пропами — незачем.
 */
export function useAbsentFilters() {
  const t = useTableState({ id: 'absent', filters: TABLE_FILTERS })
  const { columnFilters, period } = t

  const filters: AbsentChartSchemaType = useMemo(
    () => ({
      search: t.search,
      from: period.from ?? undefined,
      to: period.to ?? undefined,
      courseIds: filterIds(columnFilters, 'course'),
      locationIds: filterIds(columnFilters, 'location'),
      teacherIds: filterIds(columnFilters, 'teacher'),
      isWarned: flagFilter(columnFilters, 'warned'),
      hasMakeup: flagFilter(columnFilters, 'makeup'),
    }),
    [t.search, period, columnFilters],
  )

  return { t, filters }
}
