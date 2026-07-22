import { useQuery } from '@tanstack/react-query'
import { getRevenueData } from './actions'
import type { RevenueFilters } from './schemas'

export const revenueKeys = {
  all: ['revenue'] as const,
  data: (filters: RevenueFilters) => ['revenue', 'data', filters] as const,
}

export const useRevenueDataQuery = (filters: RevenueFilters | null) => {
  return useQuery({
    queryKey: filters ? revenueKeys.data(filters) : revenueKeys.all,
    queryFn: async () => {
      if (!filters) return null
      const result = await getRevenueData(filters)
      if (result.serverError) throw new Error(String(result.serverError))
      if (result.validationErrors) throw new Error('Ошибка валидации входных данных')
      if (!result.data) throw new Error('Сервер не вернул данные')
      return result.data
    },
    enabled: !!filters,
  })
}
