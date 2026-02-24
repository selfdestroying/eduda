import { z } from 'zod/v4'

export const AddPaymentSchema = z.object({
  student: z.object(
    {
      label: z.string(),
      value: z.number(),
    },
    'Выберите студента'
  ),
  group: z.object(
    {
      label: z.string(),
      value: z.number(),
    },
    'Выберите группу'
  ),
  lessonCount: z.number('Укажите количество занятий').positive(),
  price: z.number('Укажите сумму').positive(),
  leadName: z.string('Укажите имя лида'),
  productName: z.string('Укажите название товара'),
})

export type AddPaymentSchemaType = z.infer<typeof AddPaymentSchema>
