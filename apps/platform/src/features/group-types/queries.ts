import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createGroupType,
  deleteGroupType,
  getGroupTypes,
  getRates,
  updateGroupType,
} from './actions'
import type {
  CreateGroupTypeSchemaType,
  DeleteGroupTypeSchemaType,
  UpdateGroupTypeSchemaType,
} from './schemas'

export const groupTypeKeys = {
  all: ['groupTypes'] as const,
  lists: () => [...groupTypeKeys.all, 'list'] as const,
}

export const rateKeys = {
  all: ['rates'] as const,
}

export const useGroupTypeListQuery = () => {
  return useQuery({
    queryKey: groupTypeKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getGroupTypes()
      if (serverError) throw serverError
      return data ?? []
    },
  })
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

export const useGroupTypeCreateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreateGroupTypeSchemaType) => {
      const { data, serverError } = await createGroupType(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupTypeKeys.all })
      toast.success('Тип группы успешно создан!')
    },
    onError: () => toast.error('Не удалось создать тип группы.'),
  })
}

export const useGroupTypeUpdateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateGroupTypeSchemaType) => {
      const { data, serverError } = await updateGroupType(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupTypeKeys.all })
      toast.success('Тип группы успешно обновлен!')
    },
    onError: () => toast.error('Ошибка при обновлении типа группы.'),
  })
}

export const useGroupTypeDeleteMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DeleteGroupTypeSchemaType) => {
      const { data, serverError } = await deleteGroupType(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupTypeKeys.all })
      toast.success('Тип группы удален!')
    },
    onError: () => toast.error('Ошибка при удалении типа группы.'),
  })
}
