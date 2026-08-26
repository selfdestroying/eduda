import { DateOnlySchema } from '@/src/lib/timezone'
import * as z from 'zod'

/**
 * Состояние страницы выручки: период, отбор, страница и порядок. Всё приходит из
 * адресной строки, поэтому у каждого поля есть границы.
 *
 * `sort.id` не сужен до списка колонок: в чужих ссылках живут id переименованных
 * колонок, и `z.enum` уронил бы всю страницу вместо порядка по умолчанию. Белый
 * список — на сервере.
 */
export const RevenueListSchema = z.object({
  page: z.number().int().min(0).default(0),
  // Потолок обязателен: подобранный руками `pageSize=100000` иначе выгружает всю
  // историю посещений одним запросом.
  pageSize: z.number().int().min(1).max(100).default(10),
  sort: z.object({ id: z.string(), desc: z.boolean() }).nullish(),
  search: z.string().trim().max(100).optional(),
  // Границы включительные и сравниваются лексикографически: `Lesson.date` —
  // date-only строка `YYYY-MM-DD`. Любая может отсутствовать: «с такого-то дня»
  // и «до такого-то» законны.
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  courseIds: z.array(z.number().int().positive()).default([]),
  teacherIds: z.array(z.number().int().positive()).default([]),
  locationIds: z.array(z.number().int().positive()).default([]),
})

export type RevenueListSchemaType = z.infer<typeof RevenueListSchema>

/**
 * По чему сворачивать строки в сводке. `lesson` — это дата и группа сразу: урок
 * ими и определяется, отдельным измерением его заводить незачем.
 */
export const RevenueGroupBy = z.enum(['date', 'group', 'lesson', 'course', 'teacher', 'location'])
export type RevenueGroupBy = z.infer<typeof RevenueGroupBy>

/** Сводка живёт на тех же периоде, отборе и поиске, что и список. */
export const RevenueGroupsSchema = RevenueListSchema.extend({ by: RevenueGroupBy })

export type RevenueGroupsSchemaType = z.infer<typeof RevenueGroupsSchema>
