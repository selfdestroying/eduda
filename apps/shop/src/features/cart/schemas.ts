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

export type AddToCartSchemaType = z.infer<typeof AddToCartSchema>
export type SetCartItemQuantitySchemaType = z.infer<typeof SetCartItemQuantitySchema>
export type RemoveCartItemSchemaType = z.infer<typeof RemoveCartItemSchema>
