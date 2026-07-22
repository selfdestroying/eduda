import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createRate, deleteRate, getRates, updateRate } from './actions'
import type { CreateRateSchemaType, DeleteRateSchemaType, UpdateRateSchemaType } from './schemas'

export const rateKeys = {
  all: ['rates'] as const,
}

export const useRateListQuery = () => {
  return useQuery({
    queryKey: rateKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getRates()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useRateCreateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreateRateSchemaType) => {
      const { data, serverError } = await createRate(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateKeys.all })
      toast.success('Ставка успешно создана!')
    },
    onError: () => toast.error('Не удалось создать ставку.'),
  })
}

export const useRateUpdateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateRateSchemaType) => {
      const { data, serverError } = await updateRate(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateKeys.all })
      toast.success('Ставка успешно обновлена')
    },
    onError: () => toast.error('Ошибка при обновлении ставки'),
  })
}

export const useRateDeleteMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DeleteRateSchemaType) => {
      const { data, serverError } = await deleteRate(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateKeys.all })
      toast.success('Ставка удалена')
    },
    onError: () => toast.error('Ошибка при удалении ставки'),
  })
}
