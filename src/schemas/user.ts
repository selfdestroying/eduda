import * as z from 'zod'
import { combobox } from './_primitives'

// ─── Organization member schemas ────────────────────────────────────

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
  role: combobox('Выберите роль'),
  banned: z.boolean(),
})

export type CreateUserSchemaType = z.infer<typeof CreateUserSchema>
export type EditUserSchemaType = z.infer<typeof EditUserSchema>

// ─── Admin schemas ──────────────────────────────────────────────────

export const AdminCreateUserSchema = z.object({
  firstName: z.string().min(1, 'Имя обязательно'),
  lastName: z.string(),
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  role: z.enum(['user', 'admin', 'owner']),
})

export const AdminEditUserSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  email: z.string().email('Некорректный email'),
})

export type AdminCreateUserSchemaType = z.infer<typeof AdminCreateUserSchema>
export type AdminEditUserSchemaType = z.infer<typeof AdminEditUserSchema>
