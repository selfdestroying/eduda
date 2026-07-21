import { DateOnlySchema } from '@/src/lib/timezone'
import * as z from 'zod'

// ─── Schedule item ──────────────────────────────────────────────────
const ScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  time: z.string().min(1, 'Выберите время'),
  duration: z.number().int().positive('Укажите длительность'),
})

// ─── Teacher + rate pair ────────────────────────────────────────────
const TeacherRateSchema = z.object({
  teacherId: z.int('Выберите преподавателя').positive('Выберите преподавателя'),
  rateId: z.int('Выберите ставку').positive('Выберите ставку'),
})

// ─── Enrolled student (+ wallet choice) ─────────────────────────────
const EnrolledStudentSchema = z
  .object({
    studentId: z.int().positive(),
    walletId: z.int().positive().optional(),
    // Задан (даже пустой строкой) → создать новый кошелёк с этим именем
    newWalletName: z.string().optional(),
  })
  // Ученик зачисляется только с кошельком: либо существующий, либо новый
  .refine((v) => v.walletId !== undefined || v.newWalletName !== undefined, {
    message: 'Выберите кошелёк',
    path: ['walletId'],
  })

// ─── Base (shared editable fields) ─────────────────────────────────
export const GroupBaseSchema = z.object({
  courseId: z.int('Выберите курс').positive('Выберите курс'),
  locationId: z.int('Выберите локацию').positive('Выберите локацию'),
  groupTypeId: z.number({ error: 'Выберите тип группы' }).int().positive(),
  maxStudents: z
    .number('Введите максимальное количество учеников')
    .int()
    .positive('Количество должно быть положительным'),
  url: z.url('Неверный URL').optional(),
})

// ─── Create ─────────────────────────────────────────────────────────
export const CreateGroupSchema = GroupBaseSchema.extend({
  name: z.string(),
  teachers: z.array(TeacherRateSchema).min(1, 'Добавьте хотя бы одного преподавателя'),
  startDate: DateOnlySchema,
  schedule: z.array(ScheduleItemSchema).min(1, 'Выберите хотя бы один день занятий'),
  lessonCount: z
    .number('Введите количество занятий')
    .positive('Количество занятий должно быть положительным'),
  students: z.array(EnrolledStudentSchema),
})

// ─── Update (partial base + id) ────────────────────────────────────
export const UpdateGroupSchema = GroupBaseSchema.partial().extend({
  id: z.int().positive(),
})

// ─── Delete ─────────────────────────────────────────────────────────
export const DeleteGroupSchema = z.object({
  id: z.int().positive(),
})

// ─── Archive ────────────────────────────────────────────────────────
export const ArchiveGroupSchema = z.object({
  groupId: z.number().int().positive(),
  statusChangedAt: z.string().optional(),
  comment: z.string().optional(),
  deleteFutureLessons: z.boolean(),
})

// ─── Complete ───────────────────────────────────────────────────────
export const CompleteGroupSchema = z.object({
  groupId: z.number().int().positive(),
  statusChangedAt: z.string().optional(),
  comment: z.string().optional(),
  deleteFutureLessons: z.boolean(),
})

// ─── Schedule management ────────────────────────────────────────────
export const UpdateScheduleAndLessonsSchema = z.object({
  groupId: z.int().positive(),
  schedule: z.array(ScheduleItemSchema).min(1, 'Выберите хотя бы один день занятий'),
  startDate: DateOnlySchema.optional(),
  lessonCount: z.number().int().positive('Количество занятий должно быть положительным').optional(),
})

export const UpdateScheduleOnlySchema = z.object({
  groupId: z.int().positive(),
  schedule: z.array(ScheduleItemSchema).min(1, 'Выберите хотя бы один день занятий'),
})

// ─── Add student to group ───────────────────────────────────────────
export const AddStudentToGroupSchema = z.object({
  groupId: z.int().positive(),
  studentId: z.int().positive(),
  walletId: z.int().positive().optional(),
  isApplyToLesson: z.boolean(),
  newWalletName: z.string().optional(),
})

// ─── Delete student from group ──────────────────────────────────────
export const DeleteStudentGroupSchema = z.object({
  studentId: z.int().positive(),
  groupId: z.int().positive(),
})

// ─── Dismiss student from group ─────────────────────────────────────
export const DismissStudentSchema = z.object({
  studentId: z.int().positive(),
  groupId: z.int().positive(),
  statusChangedAt: DateOnlySchema,
  comment: z.string('Укажите комментарий'),
})

// ─── Transfer student ───────────────────────────────────────────────
export const TransferStudentSchema = z.object({
  studentId: z.int().positive(),
  oldGroupId: z.int().positive(),
  newGroupId: z.int().positive(),
})

// ─── Add teacher to group ───────────────────────────────────────────
export const AddTeacherToGroupSchema = z.object({
  groupId: z.int().positive(),
  teacherId: z.int('Выберите преподавателя').positive('Выберите преподавателя'),
  rateId: z.int('Выберите ставку').positive('Выберите ставку'),
  isApplyToLesson: z.boolean(),
})

// ─── Edit teacher group ─────────────────────────────────────────────
export const EditTeacherGroupSchema = z.object({
  teacherId: z.int().positive(),
  groupId: z.int().positive(),
  rateId: z.number('Выберите ставку').int().positive('Выберите ставку'),
  isApplyToLessons: z.boolean(),
})

// ─── Delete teacher from group ──────────────────────────────────────
export const DeleteTeacherGroupSchema = z.object({
  teacherId: z.int().positive(),
  groupId: z.int().positive(),
  isApplyToLessons: z.boolean(),
})

// ─── Create lesson for group ────────────────────────────────────────
export const CreateLessonForGroupSchema = z.object({
  groupId: z.int().positive(),
  date: DateOnlySchema,
  time: z.string('Введите время урока'),
})

// ─── Inferred types ─────────────────────────────────────────────────
export type CreateGroupSchemaType = z.infer<typeof CreateGroupSchema>
export type UpdateGroupSchemaType = z.infer<typeof UpdateGroupSchema>
export type DeleteGroupSchemaType = z.infer<typeof DeleteGroupSchema>
export type ArchiveGroupSchemaType = z.infer<typeof ArchiveGroupSchema>
export type CompleteGroupSchemaType = z.infer<typeof CompleteGroupSchema>
export type UpdateScheduleAndLessonsSchemaType = z.infer<typeof UpdateScheduleAndLessonsSchema>
export type UpdateScheduleOnlySchemaType = z.infer<typeof UpdateScheduleOnlySchema>
export type AddStudentToGroupSchemaType = z.infer<typeof AddStudentToGroupSchema>
export type DeleteStudentGroupSchemaType = z.infer<typeof DeleteStudentGroupSchema>
export type DismissStudentSchemaType = z.infer<typeof DismissStudentSchema>
export type TransferStudentSchemaType = z.infer<typeof TransferStudentSchema>
export type AddTeacherToGroupSchemaType = z.infer<typeof AddTeacherToGroupSchema>
export type EditTeacherGroupSchemaType = z.infer<typeof EditTeacherGroupSchema>
export type DeleteTeacherGroupSchemaType = z.infer<typeof DeleteTeacherGroupSchema>
export type CreateLessonForGroupSchemaType = z.infer<typeof CreateLessonForGroupSchema>
