'use client'

import { PasswordInput } from '@/src/components/password-input'
import { Button } from '@/src/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { authClient } from '@/src/lib/auth/client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader } from 'lucide-react'
import { useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import z from 'zod'
import { authErrorMessage } from './auth-errors'

interface SignInFormProps {
  onSuccess?: () => void | Promise<void>
}

const SignInSchema = z.object({
  email: z.email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

type SignInSchemaType = z.infer<typeof SignInSchema>

export function SignInForm({ onSuccess }: SignInFormProps) {
  const [loading, startTransition] = useTransition()

  const form = useForm<SignInSchemaType>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = (data: SignInSchemaType) => {
    startTransition(async () => {
      await authClient.signIn.email({
        email: data.email,
        password: data.password,
        fetchOptions: {
          async onSuccess() {
            await onSuccess?.()
          },
          onError({ error }) {
            toast.error(authErrorMessage(error))
          },
        },
      })
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
      <FieldGroup>
        <p className="text-muted-foreground text-center text-[0.78125rem] leading-relaxed">
          Войдите, чтобы продолжить работу
        </p>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
              <Input
                {...field}
                id="sign-in-email"
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
              <FieldLabel htmlFor="sign-in-password">Пароль</FieldLabel>
              <PasswordInput
                {...field}
                ref={ref}
                id="sign-in-password"
                placeholder="Ваш пароль"
                aria-invalid={fieldState.invalid}
                autoComplete="current-password"
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
        {loading ? <Loader size={16} className="animate-spin" /> : 'Войти'}
      </Button>
    </form>
  )
}
