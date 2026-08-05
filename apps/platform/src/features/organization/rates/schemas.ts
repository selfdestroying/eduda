import * as z from 'zod'

const RateBaseSchema = z.object({
  name: z.string().min(1, 'Укажите название ставки'),
  bid: z
    .number('Укажите ставку за урок')
    .int('Ставка должна быть целым числом')
    .gte(0, 'Ставка не может быть отрицательной'),
  bonusPerStudent: z
    .number('Укажите бонус за ученика')
    .int('Бонус должен быть целым числом')
    .gte(0, 'Бонус не может быть отрицательным'),
})

export const CreateRateSchema = RateBaseSchema

export const UpdateRateSchema = RateBaseSchema.extend({
  id: z.number().int().positive(),
  isApplyToLessons: z.boolean(),
})

export const DeleteRateSchema = z.object({
  id: z.number().int().positive(),
})

export type CreateRateSchemaType = z.infer<typeof CreateRateSchema>
export type UpdateRateSchemaType = z.infer<typeof UpdateRateSchema>
export type DeleteRateSchemaType = z.infer<typeof DeleteRateSchema>
