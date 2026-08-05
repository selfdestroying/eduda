import { useQuery } from '@tanstack/react-query'
import { getActiveStudents } from './actions'

export const activeKeys = {
  all: ['active-students'] as const,
  lists: () => [...activeKeys.all, 'list'] as const,
}

export const useActiveListQuery = () => {
  return useQuery({
    queryKey: activeKeys.lists(),
    queryFn: async () => {
      const { data, serverError } = await getActiveStudents()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}
