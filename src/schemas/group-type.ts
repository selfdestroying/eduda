import * as z from 'zod'

export const GroupTypeSchema = z.object({
  name: z.string().min(1, 'Укажите название типа группы'),
  rateId: z.number({ error: 'Выберите ставку' }).int().positive(),
})

export type GroupTypeSchemaType = z.infer<typeof GroupTypeSchema>
