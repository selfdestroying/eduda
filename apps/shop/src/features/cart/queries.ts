'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  addToCart,
  checkout,
  clearCart,
  getCart,
  removeCartItem,
  setCartItemQuantity,
} from './actions'
import type {
  AddToCartSchemaType,
  CheckoutSchemaType,
  RemoveCartItemSchemaType,
  SetCartItemQuantitySchemaType,
} from './schemas'
import { issueMessage } from './types'

export const cartKeys = {
  all: ['cart'] as const,
}

/**
 * Единственное место в кабинете с query-слоем: корзина реально перерисовывается
 * от действий ученика. Каталог и профиль остаются чистым RSC (§5 SPEC).
 */
export const useCartQuery = () => {
  return useQuery({
    queryKey: cartKeys.all,
    queryFn: async () => {
      const { data, serverError } = await getCart()
      if (serverError) throw serverError
      return data ?? { items: [], total: 0, coins: 0, issues: [] }
    },
  })
}

function useCartMutation<TInput>(
  mutationFn: (input: TInput) => Promise<{ serverError?: string }>,
  fallbackError: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TInput) => {
      const { serverError } = await mutationFn(input)
      if (serverError) throw new Error(serverError)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cartKeys.all }),
    onError: (error) => toast.error(error instanceof Error ? error.message : fallbackError),
  })
}

export const useAddToCartMutation = () =>
  useCartMutation<AddToCartSchemaType>(addToCart, 'Не удалось добавить товар')

export const useSetCartItemQuantityMutation = () =>
  useCartMutation<SetCartItemQuantitySchemaType>(
    setCartItemQuantity,
    'Не удалось изменить количество',
  )

export const useRemoveCartItemMutation = () =>
  useCartMutation<RemoveCartItemSchemaType>(removeCartItem, 'Не удалось убрать товар')

export const useClearCartMutation = () =>
  useCartMutation<void>(() => clearCart(), 'Не удалось очистить корзину')

/**
 * Чекаут. Проблемы возвращаются обычным результатом, а не ошибкой: их надо
 * показать списком, а канал ошибок в next-safe-action несёт только строку.
 *
 * Показываем их тостом, а не отдельным блоком на странице: блок пришлось бы
 * гасить руками при каждой правке корзины, иначе он переживал бы саму проблему.
 * Постоянную панель на странице рисует `getCart` — она всегда описывает корзину
 * в её текущем виде.
 */
export const useCheckoutMutation = () => {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: CheckoutSchemaType) => {
      const { data, serverError } = await checkout(input)
      if (serverError) throw new Error(serverError)
      if (!data) throw new Error('Пустой ответ сервера')
      return data
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all })
      if (result.ok) {
        toast.success(`Заказ №${result.orderId} оформлен`)
        // Баланс и остатки нарисованы сервером — перерисовываем их вместе с корзиной.
        router.refresh()
        router.push('/orders')
        return
      }

      toast.error(result.issues.map(issueMessage).join('\n'), {
        // Дольше обычных 2 секунд: это список, его надо успеть прочитать.
        duration: 6000,
      })
      // Цена или остаток изменились — страница показывает их с сервера.
      router.refresh()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось оформить заказ'),
  })
}
