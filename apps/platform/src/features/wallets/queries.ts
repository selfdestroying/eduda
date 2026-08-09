import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { archiveWallet, createWallet, getStudentWallets, linkGroupToWallet } from './actions'
import type {
  ArchiveWalletSchemaType,
  CreateWalletSchemaType,
  LinkGroupToWalletSchemaType,
} from './schemas'

export const walletKeys = {
  all: ['wallets'] as const,
  byStudent: (studentId: number) => ['wallets', 'student', studentId] as const,
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
