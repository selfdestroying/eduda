import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { disconnectMessenger, getCabinetMessengers } from './actions'
import type { DisconnectMessengerSchemaType } from './schemas'

export const notificationKeys = {
  messengers: (token: string) => ['notifications', token, 'messengers'] as const,
}

export const useCabinetMessengersQuery = (token: string) => {
  return useQuery({
    queryKey: notificationKeys.messengers(token),
    queryFn: async () => {
      const { data, serverError } = await getCabinetMessengers({ token })
      if (serverError) throw serverError
      return data ?? null
    },
  })
}

export const useDisconnectMessengerMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DisconnectMessengerSchemaType) => {
      const { data, serverError } = await disconnectMessenger(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.messengers(variables.token) })
      toast.success('Напоминания отключены.')
    },
    onError: () => toast.error('Не удалось отключить напоминания. Попробуйте ещё раз.'),
  })
}
