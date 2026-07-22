import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelPayment,
  createPaymentWithBalance,
  deleteUnprocessedPayment,
  getPayments,
  getStudentsForPayments,
  getUnprocessedPayments,
  resolveUnprocessedPayment,
} from './actions'
import type {
  CancelPaymentSchemaType,
  CreatePaymentSchemaType,
  DeleteUnprocessedPaymentSchemaType,
  ResolveUnprocessedPaymentSchemaType,
} from './schemas'

export const paymentKeys = {
  all: ['payments'] as const,
}

export const unprocessedPaymentKeys = {
  all: ['unprocessed-payments'] as const,
}

export const studentForPaymentKeys = {
  all: ['students-for-payments'] as const,
}

export const usePaymentListQuery = () => {
  return useQuery({
    queryKey: paymentKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getPayments()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useStudentForPaymentListQuery = () => {
  return useQuery({
    queryKey: studentForPaymentKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getStudentsForPayments()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useUnprocessedPaymentListQuery = () => {
  return useQuery({
    queryKey: unprocessedPaymentKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getUnprocessedPayments()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const usePaymentCreateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreatePaymentSchemaType) => {
      const { data, serverError } = await createPaymentWithBalance(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
      toast.success('Оплата успешно создана!')
    },
    onError: () => {
      toast.error('Не удалось создать оплату.')
    },
  })
}

export const usePaymentCancelMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CancelPaymentSchemaType) => {
      const { data, serverError } = await cancelPayment(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
      toast.success('Оплата успешно отменена')
    },
    onError: () => toast.error('Не удалось отменить оплату'),
  })
}

export const useUnprocessedPaymentResolveMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: ResolveUnprocessedPaymentSchemaType) => {
      const { data, serverError } = await resolveUnprocessedPayment(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
      queryClient.invalidateQueries({ queryKey: unprocessedPaymentKeys.all })
      toast.success('Оплата успешно создана!')
    },
    onError: () => toast.error('Не удалось создать оплату.'),
  })
}

export const useUnprocessedPaymentDeleteMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DeleteUnprocessedPaymentSchemaType) => {
      const { data, serverError } = await deleteUnprocessedPayment(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unprocessedPaymentKeys.all })
      toast.success('Неразобранная оплата успешно удалена')
    },
    onError: () => toast.error('Не удалось удалить неразобранную оплату'),
  })
}
