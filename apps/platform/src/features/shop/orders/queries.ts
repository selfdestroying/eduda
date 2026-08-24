import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { changeOrderStatus, getOrders } from './actions'
import type { ChangeOrderStatusSchemaType, OrderListSchemaType } from './schemas'

export const orderKeys = {
  all: ['orders'] as const,
  list: (params: OrderListSchemaType) => [...orderKeys.all, params] as const,
}

const EMPTY_PAGE = { rows: [], total: 0 }

export const useOrderListQuery = (params: OrderListSchemaType) => {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: async () => {
      const { data, serverError, validationErrors } = await getOrders(params)
      if (serverError) throw serverError
      // Ошибку валидации `next-safe-action` кладёт отдельно от серверной, и без
      // этой проверки она превращалась бы в `data === undefined`, то есть в пустую
      // таблицу с надписью «Нет заказов» — как будто их и правда нет.
      if (validationErrors) throw new Error('Некорректные параметры выборки заказов')
      return data ?? EMPTY_PAGE
    },
    // Пока грузится следующая страница, показываем предыдущую: иначе на каждый
    // клик по «вперёд» таблица моргает пустотой и скачет по высоте.
    placeholderData: keepPreviousData,
  })
}

export const useChangeOrderStatusMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ChangeOrderStatusSchemaType) => {
      const { data, serverError } = await changeOrderStatus(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
      toast.success('Статус заказа обновлен!')
    },
    onError: () => {
      toast.error('Ошибка при обновлении статуса заказа.')
    },
  })
}
