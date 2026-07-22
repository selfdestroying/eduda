import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { globalSearch } from './actions'

export const searchKeys = {
  all: ['search'] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
}

export const useGlobalSearchQuery = (query: string) => {
  const trimmed = query.trim()
  return useQuery({
    queryKey: searchKeys.query(trimmed),
    queryFn: async () => {
      const { data, serverError } = await globalSearch({ query: trimmed })
      if (serverError) throw serverError
      return data ?? { students: [], groups: [], members: [] }
    },
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}
