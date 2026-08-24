import { DateOnlySchema } from '@/src/lib/timezone'
import * as z from 'zod'

/**
 * Всё состояние таблицы пропусков: страница, порядок и отбор. Сервер по нему
 * строит `where`/`orderBy`/`skip`/`take` и возвращает срез вместе с общим числом
 * строк — браузер сам ничего не отбирает и не сортирует.
 *
 * `sort.id` не сужен до списка колонок намеренно: в чужих ссылках живут id
 * переименованных колонок, и валидация роняла бы страницу вместо того, чтобы
 * молча отдать порядок по умолчанию. Белый список — на сервере.
 */
export const AbsentListSchema = z.object({
  page: z.number().int().min(0).default(0),
  // Верхняя граница — чтобы подобранный руками `pageSize=100000` не превращался в
  // выгрузку всех пропусков школы одним запросом.
  pageSize: z.number().int().min(1).max(100).default(10),
  sort: z.object({ id: z.string(), desc: z.boolean() }).nullish(),
  // Ограничение длины — не про валидацию ввода, а про стоимость: `contains` идёт
  // последовательным просмотром, и незачем пускать в него полотно текста.
  search: z.string().trim().max(100).optional(),
  // Обе границы включительно и сравниваются лексикографически: `Lesson.date` —
  // date-only строка `YYYY-MM-DD`. Любая может отсутствовать, без обеих период не
  // ограничен вовсе.
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  courseIds: z.array(z.number().int().positive()).default([]),
  locationIds: z.array(z.number().int().positive()).default([]),
  teacherIds: z.array(z.number().int().positive()).default([]),
  // Признаки, а не списки: в таблице это галочки «Да»/«Нет», и обе выбранные
  // означают «не фильтруем» — до сервера такой отбор доезжает как `undefined`.
  // `isWarned` в базе nullable, поэтому `false` здесь значит «false или не
  // проставлено»: с точки зрения школы никто не предупреждал ни там, ни там.
  isWarned: z.boolean().optional(),
  /** Назначена ли на пропуск отработка. */
  hasMakeup: z.boolean().optional(),
})

export type AbsentListSchemaType = z.infer<typeof AbsentListSchema>

/**
 * Отбор без страницы и порядка. Тем же набором пользуется график: он показывает
 * ровно то, что отобрано в таблице, только в разрезе времени.
 */
export const AbsentChartSchema = AbsentListSchema.omit({ page: true, pageSize: true, sort: true })

export type AbsentChartSchemaType = z.infer<typeof AbsentChartSchema>
