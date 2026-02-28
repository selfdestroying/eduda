import * as z from 'zod'
import { DateOnlySchema } from './_primitives'

export const CreatePaycheckSchema = z.object({
  amount: z.number('Укажите корректную сумму').min(0, 'Сумма должна быть неотрицательной'),
  date: DateOnlySchema,
  comment: z.string('Укажите комментарий').max(255),
})

export type CreatePaycheckSchemaType = z.infer<typeof CreatePaycheckSchema>
