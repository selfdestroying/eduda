import { useQuery } from '@tanstack/react-query'
import { getAbsentStatistics, getActiveStudentStatistics, getDismissedStatistics } from './actions'

export const statisticsKeys = {
  all: ['statistics'] as const,
  active: () => [...statisticsKeys.all, 'active'] as const,
  dismissed: () => [...statisticsKeys.all, 'dismissed'] as const,
  absent: () => [...statisticsKeys.all, 'absent'] as const,
}

export const useActiveStatisticsQuery = () => {
  return useQuery({
    queryKey: statisticsKeys.active(),
    queryFn: async () => {
      const { data, serverError } = await getActiveStudentStatistics()
      if (serverError) throw serverError
      return data!
    },
  })
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

export const useAbsentStatisticsQuery = () => {
  return useQuery({
    queryKey: statisticsKeys.absent(),
    queryFn: async () => {
      const { data, serverError } = await getAbsentStatistics()
      if (serverError) throw serverError
      return data!
    },
  })
}
