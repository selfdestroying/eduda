import * as z from 'zod'

export const ChangeOrderStatusSchema = z.object({
  id: z.int().positive(),
  newStatus: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']),
})

export type ChangeOrderStatusSchemaType = z.infer<typeof ChangeOrderStatusSchema>
