import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { studentKeys } from '@/src/features/students/queries'
import { walletKeys } from '@/src/features/wallets/queries'
import {
  cancelPackage,
  createPackage,
  deleteUnprocessedPayment,
  getPackages,
  getUnprocessedPayments,
  resolveUnprocessedPayment,
} from './actions'
import type {
  PackageIdSchemaType,
  CreatePackageSchemaType,
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

/**
 * Что устаревает от любого движения пакета. Пакет — это уроки на балансе кошелька,
 * поэтому вместе со списком обновляются предпросмотр кошелька, счётчик занятий,
 * ждущих оплаты, и карточка ученика: все трое читают те же цифры из других ключей.
 */
function invalidatePackageMoney(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: packageKeys.all })
  queryClient.invalidateQueries({ queryKey: walletKeys.all })
  queryClient.invalidateQueries({ queryKey: studentKeys.all })
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
      // таблицу с надписью «Нет пакетов» — как будто у школы и правда нет продаж.
      if (validationErrors) throw new Error('Некорректные параметры выборки пакетов')
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

export const useCreatePackageMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreatePackageSchemaType) => {
      const { data, serverError } = await createPackage(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      invalidatePackageMoney(queryClient)
      toast.success('Пакет добавлен!')
    },
    onError: () => {
      toast.error('Не удалось добавить пакет.')
    },
  })
}

export const usePackageCancelMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: PackageIdSchemaType) => {
      const { data, serverError } = await cancelPackage(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      invalidatePackageMoney(queryClient)
      toast.success('Пакет отменён')
    },
    onError: () => toast.error('Не удалось отменить пакет'),
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
      invalidatePackageMoney(queryClient)
      queryClient.invalidateQueries({ queryKey: unprocessedPaymentKeys.all })
      toast.success('Пакет добавлен!')
    },
    onError: () => toast.error('Не удалось добавить пакет.'),
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
