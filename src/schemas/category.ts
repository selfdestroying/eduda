import * as z from 'zod'

export const CategorySchema = z.object({
  name: z
    .string('Введите название категории')
    .min(2, 'Название должно содержать не менее 2 символов')
    .max(50, 'Название не должно превышать 50 символов'),
})

export type CategorySchemaType = z.infer<typeof CategorySchema>
