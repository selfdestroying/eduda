'use client'

import { filterIds, useTableState } from '@/src/hooks/use-table-state'
import { useMemo } from 'react'
import type { EnrollmentScopeSchemaType } from './schemas'

/**
 * Колонки, по которым фильтруем: `useTableState` держит их в URL, а отсюда они
 * уезжают в запрос. Всё строками, включая id, — значения приходят из адреса, и в
 * числа их превращает уже сборка параметров запроса.
 */
const TABLE_FILTERS = {
  course: 'string',
  location: 'string',
  teacher: 'string',
} as const

/**
 * Отбор, общий для таблицы записей и графика над ней: период, курс, локация,
 * преподаватель, поиск. Страницы и порядка здесь нет — графику они не нужны.
 * Статусов тоже: их задаёт таблице страница, а график их не касается — оба его
 * ряда считаются по фактическим урокам.
 *
 * Хук зовут оба компонента, каждый сам, и видят они одно и то же: отбор живёт в
 * адресной строке, а не в React. Поэтому сводить их через общего родителя —
 * тащить состояние таблицы на страницу и раздавать пропами — незачем. `id` идёт
 * в обе стороны одинаковый: по нему в `localStorage` лежит видимость колонок, и
 * страница задаёт его один раз для пары.
 */
export function useEnrollmentFilters({ id }: { id: string }) {
  const t = useTableState({ id, filters: TABLE_FILTERS })
  const { columnFilters, period } = t

  const filters: EnrollmentScopeSchemaType = useMemo(
    () => ({
      search: t.search,
      from: period.from ?? undefined,
      to: period.to ?? undefined,
      courseIds: filterIds(columnFilters, 'course'),
      locationIds: filterIds(columnFilters, 'location'),
      teacherIds: filterIds(columnFilters, 'teacher'),
    }),
    [t.search, period, columnFilters],
  )

  return { t, filters }
}
