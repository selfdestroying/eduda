import * as z from 'zod'
import { combobox, DateOnlySchema } from './_primitives'

export const CreateGroupSchema = z.object({
  name: z.string(),
  teacher: combobox('Выберите преподавателя'),
  rate: combobox('Выберите ставку'),
  course: combobox('Выберите курс'),
  location: combobox('Выберите локацию'),
  startDate: DateOnlySchema,
  groupTypeId: z.number({ error: 'Выберите тип группы' }).int().positive(),
  schedule: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        time: z.string().min(1, 'Выберите время'),
      }),
    )
    .min(1, 'Выберите хотя бы один день занятий'),
  lessonCount: z
    .number('Введите количество занятий')
    .positive('Количество занятий должно быть положительным'),
  maxStudents: z
    .number('Введите максимальное количество учеников')
    .int()
    .positive('Количество должно быть положительным'),
  url: z.url('Неверный URL').optional(),
})

export const EditGroupSchema = z.object({
  courseId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  groupTypeId: z.number().int().positive().optional(),
  time: z.string().optional(),
  url: z.string().optional(),
  dayOfWeek: z.number().int().optional(),
})

export type CreateGroupSchemaType = z.infer<typeof CreateGroupSchema>
export type EditGroupSchemaType = z.infer<typeof EditGroupSchema>
