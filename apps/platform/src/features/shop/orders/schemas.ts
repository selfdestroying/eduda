import * as z from 'zod'

export const ChangeOrderStatusSchema = z.object({
  id: z.int().positive(),
  newStatus: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']),
})

export type ChangeOrderStatusSchemaType = z.infer<typeof ChangeOrderStatusSchema>

/**
 * Всё состояние таблицы заказов: страница, порядок и отбор. Сервер по нему строит
 * `where`/`orderBy`/`skip`/`take` и возвращает срез вместе с общим числом строк —
 * браузер сам ничего не отбирает и не сортирует.
 *
 * `sort.id` не сужен до списка колонок намеренно: в чужих ссылках живут id
 * переименованных колонок, и валидация роняла бы страницу вместо того, чтобы
 * молча отдать порядок по умолчанию. Белый список — на сервере.
 */
export const OrderListSchema = z.object({
  page: z.number().int().min(0).default(0),
  // Верхняя граница — чтобы подобранный руками `pageSize=100000` не превращался в
  // выгрузку всей истории заказов одним запросом.
  pageSize: z.number().int().min(1).max(100).default(10),
  sort: z.object({ id: z.string(), desc: z.boolean() }).nullish(),
  // Ограничение длины — не про валидацию ввода, а про стоимость: `contains` идёт
  // последовательным просмотром, и незачем пускать в него полотно текста.
  search: z.string().trim().max(100).optional(),
  statuses: z.array(z.enum(['PENDING', 'COMPLETED', 'CANCELLED'])).default([]),
})

export type OrderListSchemaType = z.infer<typeof OrderListSchema>
