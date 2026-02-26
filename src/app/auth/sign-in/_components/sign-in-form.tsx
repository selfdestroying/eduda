'use client'

import { PasswordInput } from '@/src/components/password-input'
import { Button } from '@/src/components/ui/button'
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Switch } from '@/src/components/ui/switch'
import { authClient } from '@/src/lib/auth-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LogIn } from 'lucide-react'
import { useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

const signInSchema = z.object({
  email: z.email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
  rememberMe: z.boolean(),
})

type SignInFormValues = z.infer<typeof signInSchema>

interface SignInFormProps {
  onSuccess?: () => void | Promise<void>
  showPasswordToggle?: boolean
}

export function SignInForm({ onSuccess, showPasswordToggle = false }: SignInFormProps) {
  const [loading, startTransition] = useTransition()

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const onSubmit = (data: SignInFormValues) => {
    startTransition(async () => {
      await authClient.signIn.email({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
        fetchOptions: {
          async onSuccess() {
            await onSuccess?.()
          },
          onError(context) {
            toast.error(context.error.message)
          },
        },
      })
    })
  }

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
        <FieldGroup>
          <p className="text-muted-foreground text-center text-sm">
            Войдите, чтобы продолжить работу
          </p>
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="sign-in-email">Почта</FieldLabel>
                <Input
                  {...field}
                  id="sign-in-email"
                  type="email"
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
                <div className="flex items-center">
                  <FieldLabel htmlFor="sign-in-password">Пароль</FieldLabel>
                  {/* <Link
                    href="/forget-password"
                    className="text-foreground ml-auto inline-block text-xs underline"
                  >
                    Забыли пароль?
                  </Link> */}
                </div>
                {showPasswordToggle ? (
                  <PasswordInput
                    {...field}
                    ref={ref}
                    id="sign-in-password"
                    aria-invalid={fieldState.invalid}
                    autoComplete="current-password"
                  />
                ) : (
                  <Input
                    {...field}
                    id="sign-in-password"
                    type="password"
                    aria-invalid={fieldState.invalid}
                    autoComplete="current-password"
                  />
                )}
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="rememberMe"
            control={form.control}
            render={({ field }) => (
              <FieldLabel htmlFor="sign-in-remember">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Запомнить меня</FieldTitle>
                  </FieldContent>
                  <Switch
                    id="sign-in-remember"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              </FieldLabel>
            )}
          />
        </FieldGroup>
        <Button type="submit" className="h-10 w-full gap-2 rounded-xl text-sm" disabled={loading}>
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              Войти
              <LogIn className="size-4" />
            </>
          )}
        </Button>
      </form>
    </>
  )
}
