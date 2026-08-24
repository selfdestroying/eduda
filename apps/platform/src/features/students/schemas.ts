import { DateOnlySchema } from '@/src/lib/timezone'
import * as z from 'zod'
import { CreateParentSchema } from '../parents/schemas'

const StudentBaseFields = {
  firstName: z.string({ error: 'Укажите имя' }).min(2, 'Имя должно содержать минимум 2 символа'),
  lastName: z
    .string({ error: 'Укажите фамилию' })
    .min(2, 'Фамилия должна содержать минимум 2 символа'),
  birthDate: DateOnlySchema.nullish(),
  url: z
    .string()
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v))
    .pipe(z.url('Укажите корректный URL').optional()),
}

export const CreateStudentSchema = z
  .object({
    ...StudentBaseFields,
    parentMode: z.enum(['none', 'new', 'existing']),
    newParent: CreateParentSchema.optional(),
    existingParentId: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.parentMode === 'new' && !data.newParent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Заполните данные нового родителя',
        path: ['newParent'],
      })
    }
    if (data.parentMode === 'existing' && !data.existingParentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Выберите родителя',
        path: ['existingParentId'],
      })
    }
  })

export const EditStudentSchema = z.object({
  ...StudentBaseFields,
})

export const UpdateStudentCoinsSchema = z.object({
  studentId: z.number().int().positive(),
  coins: z
    .number()
    .int('Только целые числа')
    .refine((v) => v !== 0, { message: 'Укажите количество монет' }),
})

export const DeleteStudentSchema = z.object({
  id: z.number().int().positive(),
})

export const RevealStudentPasswordSchema = z.object({
  studentId: z.number().int().positive(),
})

export type CreateStudentSchemaType = z.infer<typeof CreateStudentSchema>
export type EditStudentSchemaType = z.infer<typeof EditStudentSchema>
export type UpdateStudentCoinsSchemaType = z.infer<typeof UpdateStudentCoinsSchema>
export type DeleteStudentSchemaType = z.infer<typeof DeleteStudentSchema>
export type RevealStudentPasswordSchemaType = z.infer<typeof RevealStudentPasswordSchema>

/**
 * Всё состояние таблицы учеников: страница, порядок и отбор. Сервер по нему строит
 * `where`/`orderBy`/`skip`/`take` и возвращает срез вместе с общим числом строк —
 * браузер сам ничего не отбирает и не сортирует.
 *
 * `sort.id` не сужен до списка колонок намеренно: в чужих ссылках живут id
 * переименованных колонок, и валидация роняла бы страницу вместо того, чтобы
 * молча отдать порядок по умолчанию. Белый список — на сервере.
 */
export const StudentListSchema = z.object({
  page: z.number().int().min(0).default(0),
  // Верхняя граница — чтобы подобранный руками `pageSize=100000` не превращался в
  // выгрузку всей базы учеников одним запросом.
  pageSize: z.number().int().min(1).max(100).default(10),
  sort: z.object({ id: z.string(), desc: z.boolean() }).nullish(),
  // Ограничение длины — не про валидацию ввода, а про стоимость: `contains` идёт
  // последовательным просмотром, и незачем пускать в него полотно текста.
  search: z.string().trim().max(100).optional(),
})

export type StudentListSchemaType = z.infer<typeof StudentListSchema>
