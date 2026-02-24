import { z } from 'zod/v4'

export const CreateUserSchema = z.object({
  firstName: z.string().min(2, 'Укажите имя'),
  lastName: z.string().min(2, 'Укажите фамилию'),
  password: z.string().min(4, 'Пароль должен содержать минимум 4 символа'),
  role: z.enum(['manager', 'teacher'], 'Выберите роль'),
  email: z.email('Введите почту'),
})

export const EditUserSchema = z.object({
  firstName: z.string().min(2, 'Укажите имя'),
  lastName: z.string().optional(),
  roleId: z.number(),
})

export type CreateUserSchemaType = z.infer<typeof CreateUserSchema>
export type EditUserSchemaType = z.infer<typeof EditUserSchema>
