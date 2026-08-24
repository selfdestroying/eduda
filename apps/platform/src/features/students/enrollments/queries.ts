import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getEnrollments, returnToGroup } from './actions'
import type { EnrollmentListSchemaType, ReturnToGroupSchemaType } from './schemas'

export const enrollmentKeys = {
  all: ['enrollments'] as const,
  list: (params: EnrollmentListSchemaType) => [...enrollmentKeys.all, params] as const,
}

const EMPTY_PAGE = { rows: [], total: 0 }

export const useEnrollmentListQuery = (params: EnrollmentListSchemaType) => {
  return useQuery({
    queryKey: enrollmentKeys.list(params),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getEnrollments(params)
      if (serverError) throw serverError
      // Ошибку валидации `next-safe-action` кладёт отдельно от серверной, и без
      // этой проверки она превращалась бы в `data === undefined`, то есть в пустую
      // таблицу с надписью «Нет учеников» — как будто их и правда нет.
      if (validationErrors) throw new Error('Некорректные параметры выборки учеников')
      return data ?? EMPTY_PAGE
    },
    // Пока грузится следующая страница, показываем предыдущую: иначе на каждый
    // клик по «вперёд» таблица моргает пустотой и скачет по высоте.
    placeholderData: keepPreviousData,
  })
}

export const useReturnToGroupMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ReturnToGroupSchemaType) => {
      const { data, serverError } = await returnToGroup(input)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      // Запись уезжает из «Отчисленных» в «Активные» — устаревают оба списка, а
      // ключ у них общий.
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.all })
      toast.success('Ученик возвращён в группу')
    },
    onError: () => toast.error('Ошибка при возвращении в группу.'),
  })
}
