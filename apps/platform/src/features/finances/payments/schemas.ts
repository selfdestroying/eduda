import * as z from 'zod'

export const comboboxNumber = (error: string) =>
  z.object({ label: z.string(), value: z.number() }, error)

export const CreatePaymentSchema = z.object({
  studentId: z.int('Выберите студента').positive('Выберите студента'),
  wallet: comboboxNumber('Выберите кошелёк'),
  lessonCount: z.number('Укажите количество занятий').int().positive(),
  price: z.number('Укажите сумму').int().positive(),
  date: z.string('Выберите дату').refine(
    (val) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false

      const [year, month, day] = val.split('-').map(Number)
      const date = new Date(val)

      return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day
    },
    {
      message: 'Некорректная дата',
    },
  ),
  paymentMethodId: z.number().int().positive().nullable().optional(),
})

export const CancelPaymentSchema = z.object({
  id: z.number().int().positive(),
})

export const ResolveUnprocessedPaymentSchema = z.object({
  unprocessedPaymentId: z.number().int().positive(),
  studentId: z.int('Выберите студента').positive('Выберите студента'),
  wallet: comboboxNumber('Выберите кошелёк'),
  lessonCount: z.number('Укажите количество занятий').int().positive(),
  price: z.number('Укажите сумму').int().positive(),
  date: z.string('Выберите дату').refine(
    (val) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false

      const [year, month, day] = val.split('-').map(Number)
      const date = new Date(val)

      return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day
    },
    {
      message: 'Некорректная дата',
    },
  ),
  paymentMethodId: z.number().int().positive().nullable().optional(),
})

export const DeleteUnprocessedPaymentSchema = z.object({
  id: z.number().int().positive(),
})

export type CreatePaymentSchemaType = z.infer<typeof CreatePaymentSchema>
export type CancelPaymentSchemaType = z.infer<typeof CancelPaymentSchema>
export type ResolveUnprocessedPaymentSchemaType = z.infer<typeof ResolveUnprocessedPaymentSchema>
export type DeleteUnprocessedPaymentSchemaType = z.infer<typeof DeleteUnprocessedPaymentSchema>
