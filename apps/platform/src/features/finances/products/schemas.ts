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
  /**
   * Номер товара в amoCRM: по нему опрос оплат понимает, какой продукт продали.
   * Пустое поле приходит пустой строкой (числовой ввод отдаёт `''`), а колонка
   * ждёт число или ничего — отсюда приведение к `null`.
   */
  externalId: z
    .union([
      z.number('Номер должен быть числом').int().positive('Номер должен быть больше нуля'),
      z.literal(''),
    ])
    .nullish()
    .transform((value) => (value === '' || value === undefined ? null : value)),
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
export type UpdateProductInput = z.input<typeof UpdateProductSchema>
export type DeleteProductSchemaType = z.infer<typeof DeleteProductSchema>
