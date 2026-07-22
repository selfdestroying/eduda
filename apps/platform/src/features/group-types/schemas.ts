import * as z from 'zod'

export const GroupTypeBaseSchema = z.object({
  name: z.string().min(1, 'Укажите название типа группы'),
  rateId: z.number({ error: 'Выберите ставку' }).int().positive(),
})

export const CreateGroupTypeSchema = GroupTypeBaseSchema

export const UpdateGroupTypeSchema = GroupTypeBaseSchema.partial().extend({
  id: z.number().int().positive(),
})

export const DeleteGroupTypeSchema = z.object({
  id: z.number().int().positive(),
})

export type CreateGroupTypeSchemaType = z.infer<typeof CreateGroupTypeSchema>
export type UpdateGroupTypeSchemaType = z.infer<typeof UpdateGroupTypeSchema>
export type DeleteGroupTypeSchemaType = z.infer<typeof DeleteGroupTypeSchema>
