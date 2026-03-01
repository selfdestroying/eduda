import * as z from 'zod'

export const SignInSchema = z.object({
  email: z.email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
  rememberMe: z.boolean(),
})

export type SignInSchemaType = z.infer<typeof SignInSchema>
