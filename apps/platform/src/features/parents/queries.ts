import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createParent,
  deleteParent,
  getParents,
  linkParentToStudent,
  unlinkParentFromStudent,
  updateParent,
} from './actions'
import {
  CreateParentSchemaType,
  DeleteParentSchemaType,
  LinkParentSchemaType,
  UnlinkParentSchemaType,
  UpdateParentSchemaType,
} from './schemas'

export const parentKeys = {
  all: ['parents'] as const,
  lists: () => [...parentKeys.all, 'list'] as const,
}

export const useParentListQuery = () => {
  return useQuery({
    queryKey: parentKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getParents()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useParentCreateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CreateParentSchemaType) => {
      const { data, serverError } = await createParent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentKeys.all })
      toast.success('Родитель успешно создан!')
    },
    onError: (e) => {
      console.error(e)
      toast.error('Ошибка при создании родителя.')
    },
  })
}

export const useParentUpdateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: UpdateParentSchemaType) => {
      const { data, serverError } = await updateParent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentKeys.all })
      toast.success('Родитель обновлён!')
    },
    onError: (e) => {
      console.error(e)
      toast.error('Ошибка при обновлении родителя.')
    },
  })
}

export const useParentDeleteMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteParentSchemaType) => {
      const { data, serverError } = await deleteParent(input)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentKeys.all })
      toast.success('Родитель успешно удалён')
    },
    onError: () => {
      toast.error('Ошибка при удалении родителя.')
    },
  })
}

export const useLinkParentMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: LinkParentSchemaType) => {
      const { data, serverError } = await linkParentToStudent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentKeys.all })
      toast.success('Родитель привязан к ученику!')
    },
    onError: () => {
      toast.error('Ошибка при привязке родителя.')
    },
  })
}

export const useUnlinkParentMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: UnlinkParentSchemaType) => {
      const { data, serverError } = await unlinkParentFromStudent(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentKeys.all })
      toast.success('Родитель откреплён от ученика')
    },
    onError: () => {
      toast.error('Ошибка при откреплении родителя.')
    },
  })
}
