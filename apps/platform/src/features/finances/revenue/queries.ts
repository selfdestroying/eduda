import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRevenue, getRevenueGroups } from './actions'
import type { RevenueGroupsSchemaType, RevenueListSchemaType } from './schemas'

export const revenueKeys = {
  all: ['revenue'] as const,
  list: (params: RevenueListSchemaType) => [...revenueKeys.all, params] as const,
  groups: (params: RevenueGroupsSchemaType) => [...revenueKeys.all, 'groups', params] as const,
}

const EMPTY_PAGE = { rows: [], total: 0, revenue: 0, paidCount: 0 }
const EMPTY_GROUPS = { ...EMPTY_PAGE, attendanceCount: 0 }

export const useRevenueListQuery = (params: RevenueListSchemaType, enabled = true) => {
  return useQuery({
    enabled,
    queryKey: revenueKeys.list(params),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getRevenue(params)
      if (serverError) throw serverError
      // Иначе невалидный адрес превращается в `data === undefined`, то есть в
      // пустую таблицу с надписью «Нет занятий» — как будто выручки и правда нет.
      if (validationErrors) throw new Error('Некорректные параметры выборки')
      return data ?? EMPTY_PAGE
    },
    // Пока грузится следующая страница, показываем предыдущую: иначе таблица
    // моргает пустотой и скачет по высоте на каждый клик «вперёд».
    placeholderData: keepPreviousData,
  })
}

export const useRevenueGroupsQuery = (params: RevenueGroupsSchemaType, enabled = true) => {
  return useQuery({
    enabled,
    queryKey: revenueKeys.groups(params),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getRevenueGroups(params)
      if (serverError) throw serverError
      if (validationErrors) throw new Error('Некорректные параметры выборки')
      return data ?? EMPTY_GROUPS
    },
    placeholderData: keepPreviousData,
  })
}
