import * as z from 'zod'

export const ProductBaseSchema = z.object({
  name: z
    .string('Введите название')
    .min(1, 'Название обязательно')
    .max(100, 'Название не должно превышать 100 символов'),
  price: z.number('Укажите цену').int().positive('Цена должна быть больше нуля'),
  lessonCount: z
    .number('Укажите количество занятий')
    .int()
    .positive('Количество занятий должно быть больше нуля'),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const CreateProductSchema = ProductBaseSchema

export const UpdateProductSchema = ProductBaseSchema.partial().extend({
  id: z.int().positive(),
})

export const DeleteProductSchema = z.object({
  id: z.int().positive(),
})

export type CreateProductSchemaType = z.infer<typeof CreateProductSchema>
export type CreateProductInput = z.input<typeof CreateProductSchema>
export type UpdateProductSchemaType = z.infer<typeof UpdateProductSchema>
export type DeleteProductSchemaType = z.infer<typeof DeleteProductSchema>
