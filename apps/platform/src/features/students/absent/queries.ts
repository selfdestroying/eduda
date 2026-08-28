import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getAbsentAttendances, getAbsentChartPoints, getAbsentGroups } from './actions'
import type { AbsentChartSchemaType, AbsentGroupsSchemaType, AbsentListSchemaType } from './schemas'

export const absentKeys = {
  all: ['absent'] as const,
  list: (params: AbsentListSchemaType) => [...absentKeys.all, params] as const,
  groups: (params: AbsentGroupsSchemaType) => [...absentKeys.all, 'groups', params] as const,
  chart: (params: AbsentChartSchemaType) => [...absentKeys.all, 'chart', params] as const,
}

const EMPTY_PAGE = { rows: [], total: 0 }

/** Сводка. Выключена, пока смотрят плоский список, — иначе платим за обе выборки. */
export const useAbsentGroupsQuery = (params: AbsentGroupsSchemaType, enabled: boolean) => {
  return useQuery({
    queryKey: absentKeys.groups(params),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getAbsentGroups(params)
      if (serverError) throw serverError
      if (validationErrors) throw new Error('Некорректные параметры сводки пропусков')
      return data ?? EMPTY_PAGE
    },
    enabled,
    placeholderData: keepPreviousData,
  })
}

export const useAbsentListQuery = (params: AbsentListSchemaType, enabled = true) => {
  return useQuery({
    queryKey: absentKeys.list(params),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getAbsentAttendances(params)
      if (serverError) throw serverError
      // Ошибку валидации `next-safe-action` кладёт отдельно от серверной, и без
      // этой проверки она превращалась бы в `data === undefined`, то есть в пустую
      // таблицу с надписью «Нет пропусков» — как будто все всё отходили.
      if (validationErrors) throw new Error('Некорректные параметры выборки пропусков')
      return data ?? EMPTY_PAGE
    },
    enabled,
    // Пока грузится следующая страница, показываем предыдущую: иначе на каждый
    // клик по «вперёд» таблица моргает пустотой и скачет по высоте.
    placeholderData: keepPreviousData,
  })
}

export const useAbsentChartQuery = (params: AbsentChartSchemaType) => {
  return useQuery({
    queryKey: absentKeys.chart(params),
    queryFn: async () => {
      const { data, serverError } = await getAbsentChartPoints(params)
      if (serverError) throw serverError
      return data ?? []
    },
    // Как у таблицы: пока грузится новый отбор, показываем прошлые столбики —
    // иначе график схлопывается в скелетон на каждую галочку в фильтре.
    placeholderData: keepPreviousData,
  })
}
