import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  confirmPublicDataActuality,
  createPublicParent,
  getCabinetData,
  getPublicStudentData,
  getPublicStudentFinances,
  getPublicStudentGroups,
  updateOwnParent,
  updatePublicParent,
  updatePublicStudent,
} from './actions'
import type {
  ConfirmPublicActualitySchemaType,
  CreatePublicParentSchemaType,
  UpdateOwnParentSchemaType,
  UpdatePublicParentSchemaType,
  UpdatePublicStudentSchemaType,
} from './schemas'

export const publicEditKeys = {
  all: ['public-edit'] as const,
  cabinet: (token: string) => ['public-edit', token, 'cabinet'] as const,
  student: (token: string, studentId: number) =>
    ['public-edit', token, 'student', studentId] as const,
  finances: (token: string, studentId: number) =>
    ['public-edit', token, 'finances', studentId] as const,
  groups: (token: string, studentId: number) =>
    ['public-edit', token, 'groups', studentId] as const,
}

// ─── Read-only queries ──────────────────────────────────────────────

export const useCabinetDataQuery = (token: string) => {
  return useQuery({
    queryKey: publicEditKeys.cabinet(token),
    queryFn: async () => {
      const { data, serverError } = await getCabinetData({ token })
      if (serverError) throw serverError
      return data ?? null
    },
  })
}

export const usePublicStudentDataQuery = (token: string, studentId: number | undefined) => {
  return useQuery({
    queryKey: publicEditKeys.student(token, studentId ?? 0),
    queryFn: async () => {
      const { data, serverError } = await getPublicStudentData({ token, studentId })
      if (serverError) throw serverError
      return data ?? null
    },
    enabled: studentId != null,
  })
}

export const usePublicStudentFinancesQuery = (token: string, studentId: number | undefined) => {
  return useQuery({
    queryKey: publicEditKeys.finances(token, studentId ?? 0),
    queryFn: async () => {
      const { data, serverError } = await getPublicStudentFinances({ token, studentId })
      if (serverError) throw serverError
      return data ?? null
    },
    enabled: studentId != null,
  })
}

export const usePublicStudentGroupsQuery = (token: string, studentId: number | undefined) => {
  return useQuery({
    queryKey: publicEditKeys.groups(token, studentId ?? 0),
    queryFn: async () => {
      const { data, serverError } = await getPublicStudentGroups({ token, studentId })
      if (serverError) throw serverError
      return data ?? []
    },
    enabled: studentId != null,
  })
}

// ─── Mutations ──────────────────────────────────────────────────────

export const useUpdateOwnParentMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateOwnParentSchemaType) => {
      const { data, serverError } = await updateOwnParent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: publicEditKeys.cabinet(variables.token) })
      toast.success('Ваши данные сохранены.')
    },
    onError: () => toast.error('Не удалось сохранить ваши данные. Попробуйте ещё раз.'),
  })
}

export const useUpdatePublicStudentMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdatePublicStudentSchemaType) => {
      const { data, serverError } = await updatePublicStudent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: publicEditKeys.student(variables.token, variables.studentId),
      })
      toast.success('Данные ребёнка сохранены.')
    },
    onError: () => toast.error('Не удалось сохранить данные ребёнка. Попробуйте ещё раз.'),
  })
}

export const useUpdatePublicParentMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdatePublicParentSchemaType) => {
      const { data, serverError } = await updatePublicParent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: publicEditKeys.student(variables.token, variables.studentId),
      })
      toast.success('Данные родителя сохранены.')
    },
    onError: () => toast.error('Не удалось сохранить данные родителя. Попробуйте ещё раз.'),
  })
}

export const useCreatePublicParentMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreatePublicParentSchemaType) => {
      const { data, serverError } = await createPublicParent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: publicEditKeys.student(variables.token, variables.studentId),
      })
      toast.success('Родитель добавлен.')
    },
    onError: () => toast.error('Не удалось добавить родителя. Попробуйте ещё раз.'),
  })
}

export const useConfirmPublicActualityMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: ConfirmPublicActualitySchemaType) => {
      const { data, serverError } = await confirmPublicDataActuality(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: publicEditKeys.student(variables.token, variables.studentId),
      })
      toast.success('Актуальность данных подтверждена.')
    },
    onError: () => toast.error('Не удалось подтвердить актуальность данных.'),
  })
}
