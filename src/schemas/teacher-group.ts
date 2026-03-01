import * as z from 'zod'
import { combobox } from './_primitives'

export const AddTeacherToGroupSchema = z.object({
  teacher: combobox('Преподаватель не выбран'),
  rate: combobox('Ставка не выбрана'),
  isApplyToLesson: z.boolean(),
})

export const EditTeacherGroupSchema = z.object({
  rateId: z.number('Выберите ставку').int().positive('Выберите ставку'),
  isApplyToLessons: z.boolean(),
})

export type AddTeacherToGroupSchemaType = z.infer<typeof AddTeacherToGroupSchema>
export type EditTeacherGroupSchemaType = z.infer<typeof EditTeacherGroupSchema>
