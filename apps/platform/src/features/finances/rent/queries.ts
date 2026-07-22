import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createRent, deleteRent, getRents, updateRent } from './actions'
import type { CreateRentSchemaType, DeleteRentSchemaType, UpdateRentSchemaType } from './schemas'

export const rentKeys = {
  all: ['rents'] as const,
  lists: () => [...rentKeys.all, 'list'] as const,
}

export const useRentListQuery = () => {
  return useQuery({
    queryKey: rentKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getRents()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useRentCreateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CreateRentSchemaType) => {
      const { data, serverError } = await createRent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rentKeys.all })
      toast.success('Аренда успешно добавлена!')
    },
    onError: () => {
      toast.error('Ошибка при добавлении аренды.')
    },
  })
}

export const useRentUpdateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: UpdateRentSchemaType) => {
      const { data, serverError } = await updateRent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rentKeys.all })
      toast.success('Аренда успешно обновлена!')
    },
    onError: (e) => {
      console.error(e)
      toast.error('Ошибка при обновлении аренды.')
    },
  })
}

export const useRentDeleteMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: DeleteRentSchemaType) => {
      const { data, serverError } = await deleteRent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rentKeys.all })
      toast.success('Аренда успешно удалена!')
    },
    onError: () => {
      toast.error('Не удалось удалить аренду.')
    },
  })
}
