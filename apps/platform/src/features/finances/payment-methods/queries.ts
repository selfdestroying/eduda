import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createPaymentMethod,
  deletePaymentMethod,
  getActivePaymentMethods,
  getPaymentMethods,
  updatePaymentMethod,
} from './actions'
import type {
  CreatePaymentMethodSchemaType,
  DeletePaymentMethodSchemaType,
  UpdatePaymentMethodSchemaType,
} from './schemas'

export const paymentMethodKeys = {
  all: ['payment-methods'] as const,
  active: ['payment-methods', 'active'] as const,
}

export const usePaymentMethodListQuery = () => {
  return useQuery({
    queryKey: paymentMethodKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getPaymentMethods()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useActivePaymentMethodListQuery = () => {
  return useQuery({
    queryKey: paymentMethodKeys.active,
    queryFn: async () => {
      const { data, serverError } = await getActivePaymentMethods()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const usePaymentMethodCreateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreatePaymentMethodSchemaType) => {
      const { data, serverError } = await createPaymentMethod(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all })
      toast.success('Метод оплаты успешно создан!')
    },
    onError: () => toast.error('Ошибка при создании метода оплаты.'),
  })
}

export const usePaymentMethodUpdateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdatePaymentMethodSchemaType) => {
      const { data, serverError } = await updatePaymentMethod(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all })
      toast.success('Метод оплаты успешно обновлён!')
    },
    onError: () => toast.error('Ошибка при обновлении метода оплаты.'),
  })
}

export const usePaymentMethodDeleteMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DeletePaymentMethodSchemaType) => {
      const { data, serverError } = await deletePaymentMethod(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all })
      toast.success('Метод оплаты успешно удалён!')
    },
    onError: () => toast.error('Не удалось удалить метод оплаты.'),
  })
}
