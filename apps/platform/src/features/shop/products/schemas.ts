import * as z from 'zod'

const ProductImageSchema = z
  .instanceof(File, { error: 'Загрузите изображение продукта' })
  .refine(
    (file) => ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type),
    'Неверный формат файла. Допустимы: PNG, JPEG, SVG, WEBP',
  )
  .refine((file) => file.size <= 10 * 1024 * 1024, 'Размер файла не должен превышать 10 МБ')

export const ProductBaseSchema = z.object({
  name: z.string('Введите название продукта'),
  categoryId: z.int('Выберите категорию').positive('Выберите корректную категорию'),
  price: z.number('Введите цену продукта'),
  description: z.string().optional(),
  quantity: z.number('Введите количество продукта'),
})

export const CreateProductSchema = ProductBaseSchema.extend({
  image: ProductImageSchema,
})

export const UpdateProductSchema = ProductBaseSchema.partial().extend({
  id: z.int('Выберите продукт').positive('Выберите корректный продукт'),
  image: ProductImageSchema.optional(),
})

export const DeleteProductSchema = z.object({
  id: z.int('Выберите продукт').positive('Выберите корректный продукт'),
})

export type CreateProductSchemaType = z.infer<typeof CreateProductSchema>
export type UpdateProductSchemaType = z.infer<typeof UpdateProductSchema>
export type DeleteProductSchemaType = z.infer<typeof DeleteProductSchema>
