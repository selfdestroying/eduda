import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { changeOrderStatus, getOrders } from './actions'
import { ChangeOrderStatusSchemaType } from './schemas'

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
}

export const useOrderListQuery = () => {
  return useQuery({
    queryKey: orderKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getOrders()
      if (serverError) throw serverError
      return data ?? []
    },
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
