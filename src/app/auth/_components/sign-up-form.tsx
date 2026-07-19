'use client'

import { PasswordInput } from '@/src/components/password-input'
import { Button } from '@/src/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { authClient } from '@/src/lib/auth/client'
import { cn } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import z from 'zod'
import { authErrorMessages, FALLBACK_ERROR } from './auth-errors'

const SignUpSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Обязательно'),
    lastName: z.string().trim().min(1, 'Обязательно'),
    email: z.email('Введите корректный email'),
    password: z.string().min(8, 'Минимум 8 символов'),
    confirm: z.string().min(1, 'Повторите пароль'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  })

type SignUpSchemaType = z.infer<typeof SignUpSchema>

/** 0–4: длина, регистры, цифра, спецсимвол. */
function passwordScore(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  // ё/Ё вне диапазонов а-я и А-Я — перечисляем отдельно
  if (/[a-zа-яё]/.test(pw) && /[A-ZА-ЯЁ]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-zА-ЯЁа-яё0-9]/.test(pw)) score++
  return score
}

const strengthLevels = [
  { label: 'Слабый', bar: 'bg-destructive', text: 'text-destructive' },
  { label: 'Слабый', bar: 'bg-destructive', text: 'text-destructive' },
  { label: 'Средний', bar: 'bg-amber-500', text: 'text-amber-500' },
  { label: 'Хороший', bar: 'bg-blue-500', text: 'text-blue-500' },
  { label: 'Надёжный', bar: 'bg-emerald-500', text: 'text-emerald-500' },
]

export function SignUpForm() {
  const router = useRouter()
  const [loading, startTransition] = useTransition()

  const form = useForm<SignUpSchemaType>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirm: '',
    },
  })

  const onSubmit = (data: SignUpSchemaType) => {
    startTransition(async () => {
      await authClient.signUp.email({
        // В `User` одно поле под ФИО — склеиваем.
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        password: data.password,
        fetchOptions: {
          onSuccess() {
            // `autoSignIn` уже создал сессию, но школы ещё нет — сразу в мастер.
            // Тот же origin (`auth.*`), proxy зарерайтит в `/auth/onboarding`.
            router.push('/onboarding')
          },
          onError({ error }) {
            const code = typeof error.code === 'string' ? error.code : ''
            toast.error(authErrorMessages[code] || error.message || FALLBACK_ERROR)
          },
        },
      })
    })
  }

  const password = form.watch('password')
  const score = passwordScore(password)
  const strength = strengthLevels[score]!

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
      <FieldGroup>
        <p className="text-muted-foreground text-center text-[0.78125rem] leading-relaxed">
          Создайте аккаунт — школу настроим на следующем шаге
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="firstName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="sign-up-first-name">Имя</FieldLabel>
                <Input
                  {...field}
                  id="sign-up-first-name"
                  placeholder="Анна"
                  aria-invalid={fieldState.invalid}
                  autoComplete="given-name"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="lastName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="sign-up-last-name">Фамилия</FieldLabel>
                <Input
                  {...field}
                  id="sign-up-last-name"
                  placeholder="Смирнова"
                  aria-invalid={fieldState.invalid}
                  autoComplete="family-name"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sign-up-email">Email</FieldLabel>
              <Input
                {...field}
                id="sign-up-email"
                type="email"
                placeholder="you@school.ru"
                aria-invalid={fieldState.invalid}
                autoComplete="email"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field: { ref, ...field }, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sign-up-password">Пароль</FieldLabel>
              <PasswordInput
                {...field}
                ref={ref}
                id="sign-up-password"
                placeholder="Минимум 8 символов"
                aria-invalid={fieldState.invalid}
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="bg-muted-foreground/20 h-1 flex-1 overflow-hidden rounded-full">
                    <div
                      className={cn('h-full rounded-full transition-all', strength.bar)}
                      style={{ width: `${(score / 4) * 100}%` }}
                    />
                  </div>
                  <span className={cn('min-w-13 text-right text-xs font-medium', strength.text)}>
                    {strength.label}
                  </span>
                </div>
              )}
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="confirm"
          control={form.control}
          render={({ field: { ref, ...field }, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sign-up-confirm">Повторите пароль</FieldLabel>
              <PasswordInput
                {...field}
                ref={ref}
                id="sign-up-confirm"
                placeholder="Повторите пароль"
                aria-invalid={fieldState.invalid}
                autoComplete="new-password"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Button
        type="submit"
        className="h-10 w-full gap-2 rounded-xl text-sm font-semibold"
        disabled={loading}
      >
        {loading ? <Loader size={16} className="animate-spin" /> : 'Создать аккаунт'}
      </Button>
    </form>
  )
}
