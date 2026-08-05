import * as z from 'zod'

export const CourseBaseSchema = z.object({
  name: z
    .string('Введите название курса')
    .min(2, 'Название должно содержать не менее 2 символов')
    .max(50, 'Название не должно превышать 50 символов'),
})

export const CreateCourseSchema = CourseBaseSchema

export const UpdateCourseSchema = CourseBaseSchema.partial().extend({
  id: z.int().positive(),
})

export const DeleteCourseSchema = z.object({
  id: z.int().positive(),
})

export type CreateCourseSchemaType = z.infer<typeof CreateCourseSchema>
export type UpdateCourseSchemaType = z.infer<typeof UpdateCourseSchema>
export type DeleteCourseSchemaType = z.infer<typeof DeleteCourseSchema>
