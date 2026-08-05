import * as z from 'zod'

export const CreateParentSchema = z.object({
  firstName: z.string({ error: 'Укажите имя' }).min(2, 'Имя должно содержать минимум 2 символа'),
  lastName: z.string().min(2, 'Фамилия должна содержать минимум 2 символа').optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,15}$/, 'Укажите корректный номер телефона')
    .optional(),
  email: z.string().email('Укажите корректный email').optional(),
})

export const UpdateParentSchema = z.object({
  id: z.number().int().positive(),
  firstName: z.string({ error: 'Укажите имя' }).min(2, 'Имя должно содержать минимум 2 символа'),
  lastName: z.string().min(2, 'Фамилия должна содержать минимум 2 символа').optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,15}$/, 'Укажите корректный номер телефона')
    .optional(),
  email: z.string().email('Укажите корректный email').optional(),
})

export const DeleteParentSchema = z.object({
  id: z.number().int().positive(),
})

export const LinkParentSchema = z.object({
  studentId: z.number().int().positive(),
  parentId: z.number().int().positive(),
})

export const UnlinkParentSchema = z.object({
  studentId: z.number().int().positive(),
  parentId: z.number().int().positive(),
})

export type CreateParentSchemaType = z.infer<typeof CreateParentSchema>
export type UpdateParentSchemaType = z.infer<typeof UpdateParentSchema>
export type DeleteParentSchemaType = z.infer<typeof DeleteParentSchema>
export type LinkParentSchemaType = z.infer<typeof LinkParentSchema>
export type UnlinkParentSchemaType = z.infer<typeof UnlinkParentSchema>
