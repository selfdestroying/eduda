import * as z from 'zod'
import { comboboxNumber } from './_primitives'

export const AddStudentToGroupSchema = z.object({
  target: comboboxNumber('Выберите значение'),
  isApplyToLesson: z.boolean(),
})

export type AddStudentToGroupSchemaType = z.infer<typeof AddStudentToGroupSchema>
