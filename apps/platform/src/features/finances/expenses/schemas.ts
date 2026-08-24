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

/**
 * Всё состояние таблицы расходов: страница, порядок и отбор. Сервер по нему строит
 * `where`/`orderBy`/`skip`/`take` и возвращает срез вместе с общим числом строк —
 * браузер сам ничего не отбирает и не сортирует.
 *
 * `sort.id` не сужен до списка колонок намеренно: в чужих ссылках живут id
 * переименованных колонок, и валидация роняла бы страницу вместо того, чтобы
 * молча отдать порядок по умолчанию. Белый список — на сервере.
 */
export const ExpenseListSchema = z.object({
  page: z.number().int().min(0).default(0),
  // Верхняя граница — чтобы подобранный руками `pageSize=100000` не превращался в
  // выгрузку всей истории расходов одним запросом.
  pageSize: z.number().int().min(1).max(100).default(10),
  sort: z.object({ id: z.string(), desc: z.boolean() }).nullish(),
  // Ограничение длины — не про валидацию ввода, а про стоимость: `contains` идёт
  // последовательным просмотром, и незачем пускать в него полотно текста.
  search: z.string().trim().max(100).optional(),
  // Обе границы включительно и сравниваются лексикографически: `Expense.date` —
  // date-only строка `YYYY-MM-DD`. Любая может отсутствовать, без обеих период не
  // ограничен вовсе.
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  amountMin: z.number().int().nullish(),
  amountMax: z.number().int().nullish(),
})

export type ExpenseListSchemaType = z.infer<typeof ExpenseListSchema>
