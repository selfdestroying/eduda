import * as z from 'zod'
import { DateOnlySchema } from './_primitives'

export const DismissStudentSchema = z.object({
  date: DateOnlySchema,
  comment: z.string('Укажите комментарий'),
})

export type DismissStudentSchemaType = z.infer<typeof DismissStudentSchema>
