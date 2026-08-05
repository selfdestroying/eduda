import * as z from 'zod'

export const PaymentMethodBaseSchema = z.object({
  name: z
    .string('Введите название')
    .min(1, 'Название обязательно')
    .max(100, 'Название не должно превышать 100 символов'),
  commission: z
    .number('Укажите комиссию')
    .min(0, 'Комиссия не может быть отрицательной')
    .max(100, 'Комиссия не может быть больше 100%')
    .default(0),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const CreatePaymentMethodSchema = PaymentMethodBaseSchema

export const UpdatePaymentMethodSchema = PaymentMethodBaseSchema.partial().extend({
  id: z.int().positive(),
})

export const DeletePaymentMethodSchema = z.object({
  id: z.int().positive(),
})

export type CreatePaymentMethodSchemaType = z.infer<typeof CreatePaymentMethodSchema>
export type CreatePaymentMethodInput = z.input<typeof CreatePaymentMethodSchema>
export type UpdatePaymentMethodSchemaType = z.infer<typeof UpdatePaymentMethodSchema>
export type DeletePaymentMethodSchemaType = z.infer<typeof DeletePaymentMethodSchema>
