import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  archiveProduct,
  createProduct,
  getProducts,
  restoreProduct,
  updateProduct,
} from './actions'
import {
  ArchiveProductSchemaType,
  CreateProductSchemaType,
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

export const useProductArchiveMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (product: ArchiveProductSchemaType) => {
      const { data, serverError } = await archiveProduct(product)
      if (serverError) {
        throw serverError
      }
      return data
    },
    onError: () => {
      toast.error('Не удалось архивировать товар')
    },
    onSuccess: () => {
      toast.success('Товар перемещён в архив')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export const useProductRestoreMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (product: ArchiveProductSchemaType) => {
      const { data, serverError } = await restoreProduct(product)
      if (serverError) {
        throw serverError
      }
      return data
    },
    onError: () => {
      toast.error('Не удалось вернуть товар из архива')
    },
    onSuccess: () => {
      toast.success('Товар возвращён в каталог')
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
