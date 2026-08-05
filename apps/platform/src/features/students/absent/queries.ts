import { useQuery } from '@tanstack/react-query'
import { getAbsentAttendances } from './actions'

export const absentKeys = {
  all: ['absent'] as const,
  lists: () => [...absentKeys.all, 'list'] as const,
}

export const useAbsentListQuery = () => {
  return useQuery({
    queryKey: absentKeys.lists(),
    queryFn: async () => {
      const { data, serverError } = await getAbsentAttendances()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}
