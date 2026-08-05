import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getTaxConfig, upsertTaxConfig } from './actions'
import type { UpsertTaxConfigSchemaType } from './schemas'

export const taxConfigKeys = {
  all: ['taxConfig'] as const,
}

export const useTaxConfigQuery = () => {
  return useQuery({
    queryKey: taxConfigKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getTaxConfig()
      if (serverError) throw serverError
      return data ?? null
    },
  })
}

export const useTaxConfigUpsertMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpsertTaxConfigSchemaType) => {
      const { data, serverError } = await upsertTaxConfig(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taxConfigKeys.all })
      toast.success('Настройки налогообложения сохранены!')
    },
    onError: () => toast.error('Не удалось сохранить настройки.'),
  })
}
