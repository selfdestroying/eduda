import { z } from 'zod/v4'

export const CreateGroupTypeSchema = z.object({
  name: z.string().min(1, 'Укажите название типа группы'),
  rateId: z.number({ error: 'Выберите ставку' }).int().positive(),
})

export const EditGroupTypeSchema = z.object({
  name: z.string().min(1, 'Укажите название типа группы'),
  rateId: z.number({ error: 'Выберите ставку' }).int().positive(),
})

export type CreateGroupTypeSchemaType = z.infer<typeof CreateGroupTypeSchema>
export type EditGroupTypeSchemaType = z.infer<typeof EditGroupTypeSchema>
