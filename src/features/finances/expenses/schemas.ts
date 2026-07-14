import { DateOnlySchema } from '@/src/lib/timezone'
import * as z from 'zod'

export const ExpenseBaseSchema = z.object({
  name: z
    .string('Введите название')
    .min(1, 'Название обязательно')
    .max(100, 'Название не должно превышать 100 символов'),
  amount: z.int('Укажите сумму').positive('Сумма должна быть больше 0'),
  date: DateOnlySchema,
  comment: z.string().max(200, 'Комментарий не должен превышать 200 символов').optional(),
})

export const CreateExpenseSchema = ExpenseBaseSchema

export const UpdateExpenseSchema = ExpenseBaseSchema.partial().extend({
  id: z.int().positive(),
})

export const DeleteExpenseSchema = z.object({
  id: z.int().positive(),
})

export type CreateExpenseSchemaType = z.infer<typeof CreateExpenseSchema>
export type UpdateExpenseSchemaType = z.infer<typeof UpdateExpenseSchema>
export type DeleteExpenseSchemaType = z.infer<typeof DeleteExpenseSchema>
