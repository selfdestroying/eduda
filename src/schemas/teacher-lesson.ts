import * as z from 'zod'
import { combobox } from './_primitives'

export const AddTeacherToLessonSchema = z.object({
  teacher: combobox('Преподаватель не выбран'),
  bid: z.number('Не указана ставка').int('Ставка должна быть числом'),
  bonusPerStudent: z
    .number('Не указан бонус за ученика')
    .int('Бонус за ученика должен быть числом'),
})

export const EditTeacherLessonSchema = z.object({
  bid: z
    .number('Не указана ставка')
    .int('Ставка должна быть числом')
    .gte(0, 'Ставка должна быть >= 0'),
  bonusPerStudent: z
    .number('Не указан бонус')
    .int('Бонус должен быть целым числом')
    .gte(0, 'Бонус должен быть >= 0'),
})

export type AddTeacherToLessonSchemaType = z.infer<typeof AddTeacherToLessonSchema>
export type EditTeacherLessonSchemaType = z.infer<typeof EditTeacherLessonSchema>
