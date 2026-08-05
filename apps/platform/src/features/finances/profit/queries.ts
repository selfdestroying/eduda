import { useQuery } from '@tanstack/react-query'
import { getProfitMonthlyData } from './actions'
import type { ProfitFilters } from './schemas'

export const profitKeys = {
  all: ['profit'] as const,
  data: (filters: ProfitFilters) => ['profit', 'data', filters] as const,
  monthly: (year: number) => ['profit', 'monthly', year] as const,
}

export const useProfitMonthlyQuery = (year: number) => {
  return useQuery({
    queryKey: profitKeys.monthly(year),
    queryFn: async () => {
      const result = await getProfitMonthlyData({ year })
      if (result.serverError) throw new Error(String(result.serverError))
      if (result.validationErrors) throw new Error('Ошибка валидации входных данных')
      if (!result.data) throw new Error('Сервер не вернул данные')
      return result.data
    },
    staleTime: 5 * 60 * 1000,
  })
}
