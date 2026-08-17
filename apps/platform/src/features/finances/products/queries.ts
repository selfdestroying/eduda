import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createProduct,
  deleteProduct,
  getActiveProducts,
  getProducts,
  updateProduct,
} from './actions'
import type {
  CreateProductSchemaType,
  DeleteProductSchemaType,
  UpdateProductSchemaType,
} from './schemas'

export const productKeys = {
  all: ['products'] as const,
  active: ['products', 'active'] as const,
}

export const useProductListQuery = () => {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getProducts()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

export const useActiveProductListQuery = () => {
  return useQuery({
    queryKey: productKeys.active,
    queryFn: async () => {
      const { data, serverError } = await getActiveProducts()
      if (serverError) throw serverError
      return data ?? []
    },
  })
}

/**
 * Оба списка сразу: активный читает форма оплаты, и снятый с продажи продукт обязан
 * из неё исчезнуть, не дожидаясь перезагрузки страницы. Ключ `all` — префикс `active`,
 * но инвалидация по нему не задевает дочерний, поэтому оба перечислены явно.
 */
const invalidateProducts = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: productKeys.all })
  queryClient.invalidateQueries({ queryKey: productKeys.active })
}

export const useProductCreateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreateProductSchemaType) => {
      const { data, serverError } = await createProduct(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      invalidateProducts(queryClient)
      toast.success('Продукт успешно создан!')
    },
    onError: () => toast.error('Ошибка при создании продукта.'),
  })
}

export const useProductUpdateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateProductSchemaType) => {
      const { data, serverError } = await updateProduct(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      invalidateProducts(queryClient)
      toast.success('Продукт успешно обновлён!')
    },
    onError: () => toast.error('Ошибка при обновлении продукта.'),
  })
}

export const useProductDeleteMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: DeleteProductSchemaType) => {
      const { data, serverError } = await deleteProduct(values)
      if (serverError) throw serverError
      return data
    },
    onSuccess: () => {
      invalidateProducts(queryClient)
      toast.success('Продукт успешно удалён!')
    },
    onError: () => toast.error('Не удалось удалить продукт.'),
  })
}
