import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelPackage,
  sellPackage,
  deleteUnprocessedPayment,
  getPackages,
  getUnprocessedPayments,
  resolveUnprocessedPayment,
} from './actions'
import type {
  CancelPaymentSchemaType,
  SellPackageSchemaType,
  DeleteUnprocessedPaymentSchemaType,
  PackageListSchemaType,
  ResolveUnprocessedPaymentSchemaType,
} from './schemas'

export const packageKeys = {
  all: ['packages'] as const,
  list: (period: PackageListSchemaType) => [...packageKeys.all, period] as const,
}

export const unprocessedPaymentKeys = {
  all: ['unprocessed-payments'] as const,
}

const EMPTY_PAGE = { rows: [], total: 0 }

export const usePackageListQuery = (params: PackageListSchemaType) => {
  return useQuery({
    queryKey: packageKeys.list(params),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getPackages(params)
      if (serverError) throw serverError
      // Ошибку валидации `next-safe-action` кладёт отдельно от серверной, и без
      // этой проверки она превращалась бы в `data === undefined`, то есть в пустую
      // таблицу с надписью «Нет оплат» — как будто у школы и правда нет оплат.
      if (validationErrors) throw new Error('Некорректные параметры выборки оплат')
      return data ?? EMPTY_PAGE
    },
    // Пока грузится следующая страница, показываем предыдущую: иначе на каждый
    // клик по «вперёд» таблица моргает пустотой и скачет по высоте.
    placeholderData: keepPreviousData,
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

export const useSellPackageMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: SellPackageSchemaType) => {
      const { data, serverError } = await sellPackage(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packageKeys.all })
      toast.success('Оплата успешно создана!')
    },
    onError: () => {
      toast.error('Не удалось создать оплату.')
    },
  })
}

export const usePackageCancelMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CancelPaymentSchemaType) => {
      const { data, serverError } = await cancelPackage(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packageKeys.all })
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
      queryClient.invalidateQueries({ queryKey: packageKeys.all })
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
