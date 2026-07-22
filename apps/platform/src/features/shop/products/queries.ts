import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createProduct, deleteProduct, getProducts, updateProduct } from './actions'
import {
  CreateProductSchemaType,
  DeleteProductSchemaType,
  UpdateProductSchemaType,
} from './schemas'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
}

export const useProductListQuery = () => {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getProducts()
      if (serverError) {
        throw serverError
      }
      return data ?? []
    },
  })
}

export const useProductCreateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CreateProductSchemaType) => {
      const { data, serverError } = await createProduct(values)
      if (serverError) {
        throw serverError
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      toast.success('Продукт успешно создан!')
    },
    onError: () => {
      toast.error('Ошибка при создании продукта.')
    },
  })
}

export const useProductDeleteMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (deletedProduct: DeleteProductSchemaType) => {
      const { data, serverError } = await deleteProduct(deletedProduct)
      if (serverError) {
        throw serverError
      }
      return data
    },
    onError: () => {
      toast.error('Не удалось удалить продукт')
    },
    onSuccess: () => {
      toast.success('Продукт успешно удален')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export const useProductUpdateMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updatedProduct: UpdateProductSchemaType) => {
      const { data, serverError } = await updateProduct(updatedProduct)
      if (serverError) {
        throw serverError
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      toast.success('Продукт успешно обновлен!')
    },
    onError: () => {
      toast.error('Ошибка при обновлении продукта.')
    },
  })
}
