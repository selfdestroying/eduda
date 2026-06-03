import { useQuery } from '@tanstack/react-query'
import { getCompletedStudents } from './actions'

export const activeKeys = {
  all: ['completed-students'] as const,
  lists: () => [...activeKeys.all, 'list'] as const,
}

export const useCompletedListQuery = () => {
  return useQuery({
    queryKey: activeKeys.lists(),
    queryFn: async () => {
      const { data, serverError } = await getCompletedStudents()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}
