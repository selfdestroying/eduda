import * as z from 'zod'
import { normalizeDateOnly } from '../lib/timezone'
import { getAgeFromBirthDate } from '../lib/utils'

const MIN_STUDENT_AGE = 6
const MAX_STUDENT_AGE = 17

const validateAge = (values: { birthDate: Date }, ctx: z.RefinementCtx) => {
  const age = getAgeFromBirthDate(values.birthDate)

  if (age < MIN_STUDENT_AGE) {
    ctx.addIssue({
      code: 'custom',
      path: ['birthDate'],
      message: `Возраст не менее ${MIN_STUDENT_AGE} лет`,
    })
  }

  if (age > MAX_STUDENT_AGE) {
    ctx.addIssue({
      code: 'custom',
      path: ['birthDate'],
      message: `Возраст не более ${MAX_STUDENT_AGE} лет`,
    })
  }
}

const StudentBaseFields = {
  firstName: z.string({ error: 'Укажите имя' }).min(2, 'Имя должно содержать минимум 2 символа'),
  lastName: z
    .string({ error: 'Укажите фамилию' })
    .min(2, 'Фамилия должна содержать минимум 2 символа'),
  login: z.string({ error: 'Укажите логин' }).min(2, 'Логин должен содержать минимум 2 символа'),
  password: z
    .string({ error: 'Укажите пароль' })
    .min(2, 'Пароль должен содержать минимум 2 символа'),
  birthDate: z.date({ error: 'Укажите дату рождения' }).transform(normalizeDateOnly),
  parentsPhone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,15}$/, 'Укажите корректный номер телефона')
    .optional(),
  url: z.string().url('Укажите корректный URL').optional(),
  coins: z.number({ error: 'Укажите количество монет' }).int().nonnegative().optional(),
}

export const CreateStudentSchema = z
  .object({
    ...StudentBaseFields,
    parentsName: z.string().optional(),
  })
  .superRefine(validateAge)

export type CreateStudentSchemaType = z.infer<typeof CreateStudentSchema>

// Per-group financial balance entry for the edit form
export const GroupBalanceSchema = z.object({
  groupId: z.number(),
  groupName: z.string(),
  lessonsBalance: z.number().int().optional(),
  totalPayments: z.number().int().optional(),
  totalLessons: z.number().int().optional(),
})

export type GroupBalanceSchemaType = z.infer<typeof GroupBalanceSchema>

export const EditStudentSchema = z
  .object({
    ...StudentBaseFields,
    parentsName: z.string().min(2, 'Минимум 2 символа').optional(),
    groupBalances: z.array(GroupBalanceSchema),
  })
  .superRefine(validateAge)

export type EditStudentSchemaType = z.infer<typeof EditStudentSchema>
