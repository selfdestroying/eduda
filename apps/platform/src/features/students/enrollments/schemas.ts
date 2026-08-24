import { DateOnlySchema } from '@/src/lib/timezone'
import * as z from 'zod'

/**
 * Всё состояние таблицы записей «ученик — группа»: страница, порядок и отбор.
 * Сервер по нему строит `where`/`orderBy`/`skip`/`take` и возвращает срез вместе с
 * общим числом строк — браузер сам ничего не отбирает и не сортирует.
 *
 * Одна схема на «Активных», «Завершивших» и «Отчисленных»: это один и тот же
 * список с разным `statuses`. Три копии выборки разъезжались при каждой правке —
 * фильтр, добавленный активным, до отчисленных не доезжал.
 *
 * `sort.id` не сужен до списка колонок намеренно: в чужих ссылках живут id
 * переименованных колонок, и валидация роняла бы страницу вместо того, чтобы
 * молча отдать порядок по умолчанию. Белый список — на сервере.
 */
export const EnrollmentListSchema = z.object({
  page: z.number().int().min(0).default(0),
  // Верхняя граница — чтобы подобранный руками `pageSize=100000` не превращался в
  // выгрузку всех учеников школы одним запросом.
  pageSize: z.number().int().min(1).max(100).default(10),
  sort: z.object({ id: z.string(), desc: z.boolean() }).nullish(),
  // Ограничение длины — не про валидацию ввода, а про стоимость: `contains` идёт
  // последовательным просмотром, и незачем пускать в него полотно текста.
  search: z.string().trim().max(100).optional(),
  /**
   * Какие записи показывать. Задаёт страница, а не человек: «Активные» — это
   * `['ACTIVE', 'TRIAL']`, и пробный ученик числится активным ровно потому, что
   * ходит на занятия. Пустой список означал бы «все статусы», и страница
   * отчисленных показала бы всю школу, поэтому он обязателен и непустой.
   */
  statuses: z
    .array(z.enum(['TRIAL', 'ACTIVE', 'DISMISSED', 'TRANSFERRED', 'COMPLETED', 'ARCHIVED']))
    .min(1),
  /**
   * Когда статус сменился — день отчисления или завершения. Обе границы
   * включительно и сравниваются лексикографически: `StudentGroup.statusChangedAt`
   * это date-only строка `YYYY-MM-DD`. Любая может отсутствовать, без обеих
   * период не ограничен вовсе.
   */
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  courseIds: z.array(z.number().int().positive()).default([]),
  locationIds: z.array(z.number().int().positive()).default([]),
  teacherIds: z.array(z.number().int().positive()).default([]),
})

export type EnrollmentListSchemaType = z.infer<typeof EnrollmentListSchema>

export const ReturnToGroupSchema = z.object({
  groupId: z.number().int().positive(),
  studentId: z.number().int().positive(),
})

export type ReturnToGroupSchemaType = z.infer<typeof ReturnToGroupSchema>
