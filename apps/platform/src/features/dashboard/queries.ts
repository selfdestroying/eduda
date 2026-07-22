'use client'

import { useQuery } from '@tanstack/react-query'
import { getDashboardMonthData } from './actions'
import type { DashboardMonthData } from './types'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  month: (month: string) => ['dashboard', 'month', month] as const,
}

export const useDashboardMonthQuery = (month: string) => {
  return useQuery<DashboardMonthData>({
    queryKey: dashboardKeys.month(month),
    queryFn: async () => {
      const result = await getDashboardMonthData({ month })

      if (result.validationErrors) {
        throw new Error('Неверный формат месяца')
      }

      if (result.serverError) {
        throw new Error(String(result.serverError))
      }

      if (!result.data) {
        throw new Error('Сервер не вернул данные dashboard')
      }

      return result.data
    },
  })
}
