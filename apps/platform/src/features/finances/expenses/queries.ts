import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createExpense, deleteExpense, getExpenses, updateExpense } from './actions'
import type {
  CreateExpenseSchemaType,
  ExpenseListSchemaType,
  DeleteExpenseSchemaType,
  UpdateExpenseSchemaType,
} from './schemas'

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (params: ExpenseListSchemaType) => [...expenseKeys.all, params] as const,
}

const EMPTY_PAGE = { rows: [], total: 0, amountTotal: 0 }

export const useExpenseListQuery = (params: ExpenseListSchemaType) => {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getExpenses(params)
      if (serverError) throw serverError
      // Ошибку валидации `next-safe-action` кладёт отдельно от серверной, и без
      // этой проверки она превращалась бы в `data === undefined`, то есть в пустую
      // таблицу с надписью «Нет расходов» — как будто школа ничего не тратила.
      if (validationErrors) throw new Error('Некорректные параметры выборки расходов')
      return data ?? EMPTY_PAGE
    },
    // Пока грузится следующая страница, показываем предыдущую: иначе на каждый
    // клик по «вперёд» таблица моргает пустотой и скачет по высоте.
    placeholderData: keepPreviousData,
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
