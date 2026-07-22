import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createExpense, deleteExpense, getExpenses, updateExpense } from './actions'
import type {
  CreateExpenseSchemaType,
  DeleteExpenseSchemaType,
  UpdateExpenseSchemaType,
} from './schemas'

export const expenseKeys = {
  all: ['expenses'] as const,
}

export const useExpenseListQuery = () => {
  return useQuery({
    queryKey: expenseKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getExpenses()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useExpenseCreateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreateExpenseSchemaType) => {
      const { data, serverError } = await createExpense(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      toast.success('Расход успешно добавлен!')
    },
    onError: () => toast.error('Ошибка при добавлении расхода.'),
  })
}

export const useExpenseUpdateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateExpenseSchemaType) => {
      const { data, serverError } = await updateExpense(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      toast.success('Расход успешно обновлён!')
    },
    onError: () => toast.error('Ошибка при обновлении расхода.'),
  })
}

export const useExpenseDeleteMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DeleteExpenseSchemaType) => {
      const { data, serverError } = await deleteExpense(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      toast.success('Расход успешно удалён!')
    },
    onError: () => toast.error('Не удалось удалить расход.'),
  })
}
