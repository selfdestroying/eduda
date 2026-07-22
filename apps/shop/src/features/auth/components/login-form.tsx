'use client'

import { authClient } from '@/src/lib/auth/client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import { PasswordInput } from '@repo/ui/components/password-input'
import { Loader } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import z from 'zod'

const LoginSchema = z.object({
  username: z.string().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль'),
})

type LoginSchemaType = z.infer<typeof LoginSchema>

/**
 * Ошибка одна на оба случая — неверный пароль и несуществующий логин, — чтобы
 * форма не работала перебором логинов (§8 SPEC).
 */
const WRONG_CREDENTIALS = 'Неверный логин или пароль'

export function LoginForm() {
  const router = useRouter()
  const [loading, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginSchemaType>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = (data: LoginSchemaType) => {
    setError(null)
    startTransition(async () => {
      await authClient.signIn.username({
        username: data.username,
        password: data.password,
        fetchOptions: {
          onSuccess() {
            router.replace('/')
            router.refresh()
          },
          onError() {
            setError(WRONG_CREDENTIALS)
          },
        },
      })
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-username">Логин</FieldLabel>
              <Input
                {...field}
                id="login-username"
                placeholder="ivanov12"
                autoComplete="username"
                autoCapitalize="none"
                aria-invalid={fieldState.invalid}
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
              <FieldLabel htmlFor="login-password">Пароль</FieldLabel>
              <PasswordInput
                {...field}
                ref={ref}
                id="login-password"
                placeholder="Пароль из карточки ученика"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" className="h-10 w-full" disabled={loading}>
        {loading ? <Loader size={16} className="animate-spin" /> : 'Войти'}
      </Button>
    </form>
  )
}
