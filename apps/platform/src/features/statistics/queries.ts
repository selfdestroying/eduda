import { useQuery } from '@tanstack/react-query'
import { getDismissedStatistics } from './actions'

export const statisticsKeys = {
  all: ['statistics'] as const,
  dismissed: () => [...statisticsKeys.all, 'dismissed'] as const,
}

export const useDismissedStatisticsQuery = () => {
  return useQuery({
    queryKey: statisticsKeys.dismissed(),
    queryFn: async () => {
      const { data, serverError } = await getDismissedStatistics()
      if (serverError) throw serverError
      return data!
    },
  })
}
