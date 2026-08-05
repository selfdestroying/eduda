import * as z from 'zod'

export const AddToCartSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(999).default(1),
})

export const SetCartItemQuantitySchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(999),
})

export const RemoveCartItemSchema = z.object({
  productId: z.number().int().positive(),
})

/**
 * Цены, которые клиент показал ученику в момент подтверждения. Корзина снимка
 * цены не хранит, поэтому «цена изменилась» определяется только так.
 *
 * Клиенту тут доверять не нужно: списание всегда идёт по свежепрочитанной цене,
 * так что подделка этих чисел может лишь заблокировать собственный заказ.
 */
export const CheckoutSchema = z.object({
  expected: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        price: z.number().int().min(0),
      }),
    )
    .default([]),
})

export type AddToCartSchemaType = z.infer<typeof AddToCartSchema>
export type CheckoutSchemaType = z.infer<typeof CheckoutSchema>
export type SetCartItemQuantitySchemaType = z.infer<typeof SetCartItemQuantitySchema>
export type RemoveCartItemSchemaType = z.infer<typeof RemoveCartItemSchema>
