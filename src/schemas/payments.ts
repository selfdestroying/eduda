import * as z from 'zod'
import { comboboxNumber } from './_primitives'

export const AddPaymentSchema = z.object({
  student: comboboxNumber('Выберите студента'),
  group: comboboxNumber('Выберите группу'),
  lessonCount: z.number('Укажите количество занятий').int().positive(),
  price: z.number('Укажите сумму').int().positive(),
  leadName: z.string('Укажите имя лида'),
  productName: z.string('Укажите название товара'),
})

export type AddPaymentSchemaType = z.infer<typeof AddPaymentSchema>
