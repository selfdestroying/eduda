import * as z from 'zod'
import { combobox } from './_primitives'

const ProductImageSchema = z
  .instanceof(File, { error: 'Загрузите изображение продукта' })
  .refine(
    (file) => ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type),
    'Неверный формат файла. Допустимы: PNG, JPEG, SVG, WEBP',
  )
  .refine((file) => file.size <= 10 * 1024 * 1024, 'Размер файла не должен превышать 10 МБ')

const ProductBaseFields = {
  name: z
    .string('Введите название продукта')
    .min(2, 'Название должно содержать не менее 2 символов')
    .max(50, 'Название не должно превышать 50 символов'),
  category: combobox('Выберите категорию'),
  price: z.number('Введите цену продукта').int().min(0, 'Цена не может быть отрицательной'),
  description: z
    .string('Введите описание продукта')
    .max(500, 'Описание не должно превышать 500 символов'),
  quantity: z
    .number('Введите количество продукта')
    .int()
    .min(1, 'Количество должно быть не менее 1'),
}

export const CreateProductSchema = z.object({
  ...ProductBaseFields,
  image: ProductImageSchema,
})

export const EditProductSchema = z.object({
  ...ProductBaseFields,
  image: ProductImageSchema.optional(),
})

export type CreateProductSchemaType = z.infer<typeof CreateProductSchema>
export type EditProductSchemaType = z.infer<typeof EditProductSchema>
