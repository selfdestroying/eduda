import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { packageKeys } from '@/src/features/finances/payments/queries'
import { studentKeys } from '@/src/features/students/queries'
import {
  archiveWallet,
  createWallet,
  getStudentWalletUnpaid,
  getStudentWallets,
  getTransferablePackages,
  getTransferPreview,
  getWalletPreview,
  linkGroupToWallet,
  transferPackages,
} from './actions'
import type {
  ArchiveWalletSchemaType,
  CreateWalletSchemaType,
  LinkGroupToWalletSchemaType,
  TransferPackagesSchemaType,
} from './schemas'

export const walletKeys = {
  all: ['wallets'] as const,
  byStudent: (studentId: number) => ['wallets', 'student', studentId] as const,
  packages: (walletId: number) => ['wallets', 'packages', walletId] as const,
  // Порядок галочек кеш не различает: id сортируются, иначе «выбрал A, потом B» и
  // «выбрал B, потом A» — две записи с одинаковым ответом и лишний запрос на второй.
  transferPreview: (packageIds: number[], toWalletId: number) =>
    ['wallets', 'transfer-preview', [...packageIds].sort((a, b) => a - b), toWalletId] as const,
}

export const useStudentWalletsQuery = (studentId: number, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: walletKeys.byStudent(studentId),
    queryFn: async () => {
      const { data, serverError } = await getStudentWallets({ studentId })
      if (serverError) throw serverError
      return data ?? []
    },
    enabled: options?.enabled,
  })
}

export const useWalletPreviewQuery = (walletId: number | null) => {
  return useQuery({
    queryKey: [...walletKeys.all, 'preview', walletId] as const,
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getWalletPreview({
        walletId: walletId!,
      })
      if (serverError) throw serverError
      // Пустого значения по умолчанию здесь нет намеренно. Ошибку валидации
      // `next-safe-action` кладёт отдельно от серверной, и подставленный на её
      // месте пустой список означал бы «пакетов у кошелька нет» — утверждение про
      // деньги, которого сервер не делал. Предпросмотр отличает его от «ещё не
      // знаю», и различие надо сохранить (та же причина, что в
      // `finances/payments/queries.ts`).
      if (validationErrors || !data) throw new Error('Не удалось прочитать кошелёк')
      return data
    },
    enabled: walletId != null,
  })
}

/**
 * Счётчик «ждут оплаты» по всем кошелькам ученика — карточка ученика.
 *
 * Отдельно от `studentKeys.detail`, а не полем в нём: считается он денежным
 * предикатом, а не `include`, и живёт своей жизнью (оплата его гасит, отметка
 * посещаемости растит). Ключ — под `walletKeys.byStudent`, чтобы `invalidate`
 * после действий с кошельками задевал и его.
 */
export const useStudentWalletUnpaidQuery = (studentId: number) => {
  return useQuery({
    queryKey: [...walletKeys.byStudent(studentId), 'unpaid'] as const,
    queryFn: async () => {
      const { data, serverError } = await getStudentWalletUnpaid({ studentId })
      if (serverError) throw serverError
      return data ?? {}
    },
  })
}

export const useCreateWalletMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreateWalletSchemaType) => {
      const { data, serverError } = await createWallet(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: walletKeys.byStudent(variables.studentId) })
      toast.success('Кошелёк создан')
    },
    onError: () => toast.error('Не удалось создать кошелёк'),
  })
}

export const useLinkGroupToWalletMutation = (studentId: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: LinkGroupToWalletSchemaType) => {
      const { data, serverError } = await linkGroupToWallet(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.byStudent(studentId) })
      toast.success('Группа привязана к кошельку')
    },
    onError: () => toast.error('Не удалось привязать группу'),
  })
}

export const useArchiveWalletMutation = (studentId: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: ArchiveWalletSchemaType) => {
      const { data, serverError } = await archiveWallet(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.byStudent(studentId) })
      toast.success('Кошелёк архивирован')
    },
    onError: () => toast.error('Не удалось архивировать кошелёк'),
  })
}

export const useTransferablePackagesQuery = (walletId: number | null) => {
  return useQuery({
    queryKey: walletKeys.packages(walletId ?? 0),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getTransferablePackages({
        walletId: walletId!,
      })
      if (serverError) throw serverError
      // Пустого значения по умолчанию нет намеренно, как и в предпросмотре кошелька:
      // подставленный пустой список означал бы «пакетов нет» — утверждение про деньги,
      // которого сервер не делал.
      if (validationErrors || !data) throw new Error('Не удалось прочитать пакеты')
      return data
    },
    enabled: walletId != null,
  })
}

export const useTransferPreviewQuery = (packageIds: number[], toWalletId: number | null) => {
  return useQuery({
    queryKey: walletKeys.transferPreview(packageIds, toWalletId ?? 0),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getTransferPreview({
        packageIds,
        toWalletId: toWalletId!,
      })
      if (serverError) throw serverError
      if (validationErrors || !data) throw new Error('Не удалось посчитать перенос')
      return data
    },
    enabled: toWalletId != null && packageIds.length > 0,
    // Каждая галочка меняет ключ, а без этого `data` на время запроса становится
    // `undefined` — сводка и оба предупреждения исчезали и появлялись заново, дёргая
    // высоту панели. Показываем прежние цифры; что они пересчитываются, видно по
    // приглушению (`isFetching` в компоненте).
    placeholderData: keepPreviousData,
  })
}

export const useTransferPackagesMutation = (studentId: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: TransferPackagesSchemaType) => {
      const { data, serverError } = await transferPackages(values)
      // `handleServerError` отдаёт строку, а не `Error`, — без обёртки `onError` ниже
      // всегда падал бы в общее «не удалось» и прятал настоящую причину отказа.
      if (serverError) throw new Error(serverError)
      return data
    },
    onSuccess: (data) => {
      // Перенос виден и в кошельках, и в карточке ученика, и в списке пакетов.
      queryClient.invalidateQueries({ queryKey: walletKeys.all })
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(studentId) })
      queryClient.invalidateQueries({ queryKey: studentKeys.all })
      queryClient.invalidateQueries({ queryKey: packageKeys.all })
      const settled = data?.settled ?? 0
      toast.success(settled > 0 ? `Перенесено. Закрыто занятий: ${settled}` : 'Пакеты перенесены')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось перенести пакеты'),
  })
}
