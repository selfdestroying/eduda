import { useQuery } from '@tanstack/react-query'
import { getAdvancesData } from './actions'
import type { AdvancesFilters } from './schemas'

export const advancesKeys = {
  all: ['advances'] as const,
  data: (filters: AdvancesFilters) => ['advances', 'data', filters] as const,
}

export const useAdvancesDataQuery = (filters: AdvancesFilters | null) => {
  return useQuery({
    queryKey: filters ? advancesKeys.data(filters) : advancesKeys.all,
    queryFn: async () => {
      if (!filters) return null
      const result = await getAdvancesData(filters)
      if (result.serverError) throw new Error(String(result.serverError))
      if (result.validationErrors) throw new Error('Ошибка валидации входных данных')
      if (!result.data) throw new Error('Сервер не вернул данные')
      return result.data
    },
    enabled: !!filters,
  })
}
