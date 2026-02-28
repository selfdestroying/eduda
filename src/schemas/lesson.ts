import * as z from 'zod'
import { DateOnlySchema } from './_primitives'

export const CreateLessonSchema = z.object({
  date: DateOnlySchema,
  time: z.string('Введите время урока'),
})

export const EditLessonSchema = z.object({
  date: DateOnlySchema,
  time: z.string('Выберите время урока'),
  status: z.enum(['ACTIVE', 'CANCELLED'], 'Выберите статус урока'),
})

export type CreateLessonSchemaType = z.infer<typeof CreateLessonSchema>
export type EditLessonSchemaType = z.infer<typeof EditLessonSchema>
