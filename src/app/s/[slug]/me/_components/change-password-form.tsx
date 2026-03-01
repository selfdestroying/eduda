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
import { Switch } from '@/src/components/ui/switch'
import { useChangePasswordMutation } from '@/src/data/user/user-change-password-mutation'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Текущий пароль is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    revokeOtherSessions: z.boolean(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

interface ChangePasswordFormProps {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function ChangePasswordForm({ onSuccess, onError }: ChangePasswordFormProps) {
  const changePasswordMutation = useChangePasswordMutation()

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      revokeOtherSessions: false,
    },
  })

  const onSubmit = (values: ChangePasswordFormValues) => {
    changePasswordMutation.mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: values.revokeOtherSessions,
      },
      {
        onSuccess: () => {
          reset()
          onSuccess?.()
        },
        onError: (error) => {
          onError?.(error.message)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Controller
          name="currentPassword"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="current-password">Текущий пароль</FieldLabel>
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                placeholder="Текущий пароль"
                disabled={changePasswordMutation.isPending}
                {...field}
              />
              <FieldError>{errors.currentPassword?.message}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="newPassword"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="new-password">Новый пароль</FieldLabel>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                placeholder="Новый пароль"
                disabled={changePasswordMutation.isPending}
                {...field}
              />
              <FieldError>{errors.newPassword?.message}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="confirm-password">Подтверждение пароля</FieldLabel>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                placeholder="Подтверждение пароля"
                disabled={changePasswordMutation.isPending}
                {...field}
              />
              <FieldError>{errors.confirmPassword?.message}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="revokeOtherSessions"
          control={control}
          render={({ field }) => (
            <FieldLabel htmlFor="revoke-sessions">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Выйти со всех устройств</FieldTitle>
                </FieldContent>
                <Switch
                  id="revoke-sessions"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={changePasswordMutation.isPending}
                />
              </Field>
            </FieldLabel>
          )}
        />

        <Button type="submit" disabled={changePasswordMutation.isPending}>
          {changePasswordMutation.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            'Сменить пароль'
          )}
        </Button>
      </FieldGroup>
    </form>
  )
}
