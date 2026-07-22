import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getDismissedStudents, returnToGroup } from './actions'
import { ReturnToGroupSchemaType } from './schemas'

export const dismissedKeys = {
  all: ['dismissed'] as const,
  lists: () => [...dismissedKeys.all, 'list'] as const,
}

export const useDismissedListQuery = () => {
  return useQuery({
    queryKey: dismissedKeys.lists(),
    queryFn: async () => {
      const { data, serverError } = await getDismissedStudents()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useDismissedReturnMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ReturnToGroupSchemaType) => {
      const { data, serverError } = await returnToGroup(input)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dismissedKeys.all })
      toast.success('Ученик успешно возвращен в группу')
    },
    onError: () => toast.error('Ошибка при возвращении в группу.'),
  })
}
