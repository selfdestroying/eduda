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

export type CreateStudentSchemaType = z.infer<typeof CreateStudentSchema>
export type EditStudentSchemaType = z.infer<typeof EditStudentSchema>
export type UpdateStudentCoinsSchemaType = z.infer<typeof UpdateStudentCoinsSchema>
export type DeleteStudentSchemaType = z.infer<typeof DeleteStudentSchema>
