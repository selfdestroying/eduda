import { z } from 'zod/v4'

export const CreateRateSchema = z.object({
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

export const EditRateSchema = z.object({
  name: z.string().min(1, 'Укажите название ставки'),
  bid: z
    .number('Укажите ставку за урок')
    .int('Ставка должна быть целым числом')
    .gte(0, 'Ставка не может быть отрицательной'),
  bonusPerStudent: z
    .number('Укажите бонус за ученика')
    .int('Бонус должен быть целым числом')
    .gte(0, 'Бонус не может быть отрицательным'),
  isApplyToLessons: z.boolean(),
})

export type CreateRateSchemaType = z.infer<typeof CreateRateSchema>
export type EditRateSchemaType = z.infer<typeof EditRateSchema>
