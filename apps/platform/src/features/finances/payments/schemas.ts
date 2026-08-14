import { DateOnlySchema } from '@/src/lib/timezone'
import * as z from 'zod'

export const comboboxNumber = (error: string) =>
  z.object({ label: z.string(), value: z.number() }, error)

/**
 * Всё состояние таблицы оплат: страница, порядок и отбор. Сервер по нему строит
 * `where`/`orderBy`/`skip`/`take` и возвращает срез вместе с общим числом строк —
 * браузер больше ничего не отбирает и не сортирует сам.
 *
 * `sort.id` не сужен до списка колонок намеренно: в адресах живут id, которых уже
 * нет (колонки переименовывались), и валидация роняла бы запрос вместо того, чтобы
 * молча отдать порядок по умолчанию. Белый список — на сервере.
 */
export const PaymentListSchema = z.object({
  page: z.number().int().min(0).default(0),
  // Верхняя граница — чтобы подобранный руками `pageSize=100000` не превращался в
  // выгрузку всей истории одним запросом.
  pageSize: z.number().int().min(1).max(100).default(10),
  sort: z.object({ id: z.string(), desc: z.boolean() }).nullish(),
  // Ограничение длины — не про валидацию ввода, а про стоимость: `contains` идёт
  // последовательным просмотром, и незачем пускать в него полотно текста.
  search: z.string().trim().max(100).optional(),
  // Обе границы включительно и сравниваются лексикографически: `Payment.date` —
  // date-only строка `YYYY-MM-DD`. Любая может отсутствовать: «с такого-то дня» и
  // «до такого-то» законны, а без обеих период не ограничен вовсе.
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  methodIds: z.array(z.number().int().positive()).default([]),
  managerIds: z.array(z.number().int().positive()).default([]),
  statuses: z.array(z.enum(['ACTIVE', 'CANCELLED'])).default([]),
  priceMin: z.number().int().nullish(),
  priceMax: z.number().int().nullish(),
  lessonsMin: z.number().int().nullish(),
  lessonsMax: z.number().int().nullish(),
})

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
  /** Кто продал: не автор записи, а тот, кто договорился. */
  managerId: z.number().int().positive().nullable().optional(),
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
  /** Кто продал: не автор записи, а тот, кто договорился. */
  managerId: z.number().int().positive().nullable().optional(),
})

export const DeleteUnprocessedPaymentSchema = z.object({
  id: z.number().int().positive(),
})

export type PaymentListSchemaType = z.infer<typeof PaymentListSchema>
export type CreatePaymentSchemaType = z.infer<typeof CreatePaymentSchema>
export type CancelPaymentSchemaType = z.infer<typeof CancelPaymentSchema>
export type ResolveUnprocessedPaymentSchemaType = z.infer<typeof ResolveUnprocessedPaymentSchema>
export type DeleteUnprocessedPaymentSchemaType = z.infer<typeof DeleteUnprocessedPaymentSchema>
