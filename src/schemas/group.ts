import { GroupType } from '@/prisma/generated/enums'
import { z } from 'zod/v4'

export const CreateGroupSchema = z.object({
  // required
  name: z.string(),
  teacher: z.object(
    {
      label: z.string(),
      value: z.string(),
    },
    'Выберите преподавателя'
  ),
  rate: z.object(
    {
      label: z.string(),
      value: z.string(),
    },
    'Выберите ставку'
  ),
  course: z.object(
    {
      label: z.string(),
      value: z.string(),
    },
    'Выберите курс'
  ),
  location: z.object(
    {
      label: z.string(),
      value: z.string(),
    },
    'Выберите локацию'
  ),
  startDate: z.date('Выберите дату старта'),
  type: z.enum(GroupType, 'Выберите тип группы'),
  schedule: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        time: z.string().min(1, 'Выберите время'),
      })
    )
    .min(1, 'Выберите хотя бы один день занятий'),
  lessonCount: z
    .number('Введите количество занятий')
    .positive('Количество занятий должно быть положительным'),
  maxStudents: z
    .number('Введите максимальное количество учеников')
    .int()
    .positive('Количество должно быть положительным'),
  // optional
  url: z.url('Неверный URL').optional(),
})

export const editGroupSchema = z.object({
  courseId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  type: z.enum(GroupType).optional(),
  time: z.string().optional(),
  url: z.string().optional(),
  dayOfWeek: z.number().int().optional(),
})

export const StudentGroupSchema = z.object({
  studentId: z.number({
    error: 'Please select a student.',
  }),
})

export const GroupsStudentSchema = z.object({
  groupId: z.number({
    error: 'Please select a student.',
  }),
})

export const DismissSchema = z.object({
  groupId: z.number(),
  studentId: z.number(),
  comment: z.string(),
  date: z.date(),
})

export type CreateGroupSchemaType = z.infer<typeof CreateGroupSchema>
export type EditGroupSchemaType = z.infer<typeof editGroupSchema>
export type StudentGroupSchemaType = z.infer<typeof StudentGroupSchema>
export type GroupStudentSchemaType = z.infer<typeof GroupsStudentSchema>
export type DismissSchemaType = z.infer<typeof DismissSchema>
