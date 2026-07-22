import * as z from 'zod'

export const CategoryBaseSchema = z.object({
  name: z
    .string('Введите название категории')
    .min(2, 'Название должно содержать не менее 2 символов')
    .max(50, 'Название не должно превышать 50 символов'),
})

export const CreateCategorySchema = CategoryBaseSchema

export const UpdateCategorySchema = CategoryBaseSchema.partial().extend({
  id: z.int().positive(),
})

export const DeleteCategorySchema = z.object({
  id: z.int().positive(),
})

export type CreateCategorySchemaType = z.infer<typeof CreateCategorySchema>
export type UpdateCategorySchemaType = z.infer<typeof UpdateCategorySchema>
export type DeleteCategorySchemaType = z.infer<typeof DeleteCategorySchema>
