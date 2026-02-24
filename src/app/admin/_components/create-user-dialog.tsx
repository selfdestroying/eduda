'use client'

import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { authClient } from '@/src/lib/auth-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dices, Loader2, UserPlus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

const createUserSchema = z.object({
  firstName: z.string().min(1, 'Имя обязательно'),
  lastName: z.string(),
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  role: z.enum(['user', 'admin', 'owner']),
})

type CreateUserFormValues = z.infer<typeof createUserSchema>

interface CreateUserDialogProps {
  onSuccess: () => void
}

export default function CreateUserDialog({ onSuccess }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'user',
    },
  })

  const generatePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)]
    }
    setValue('password', password)
  }

  const onSubmit = (values: CreateUserFormValues) => {
    const name = `${values.firstName} ${values.lastName}`.trim()
    startTransition(async () => {
      try {
        const { error } = await authClient.admin.createUser({
          email: values.email,
          password: values.password,
          name,
          role: values.role,
          data: {
            firstName: values.firstName,
            lastName: values.lastName,
          },
        })
        if (error) throw new Error(error.message)
        toast.success('Пользователь создан')
        setOpen(false)
        reset()
        onSuccess()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка при создании')
      }
    })
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <UserPlus className="size-4" />
        Создать
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать пользователя</DialogTitle>
          <DialogDescription>Заполните данные нового пользователя</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={control}
                name="firstName"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Имя</FieldLabel>
                    <Input {...field} placeholder="Имя" />
                    <FieldError>{errors.firstName?.message}</FieldError>
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="lastName"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Фамилия</FieldLabel>
                    <Input {...field} placeholder="Фамилия" />
                  </Field>
                )}
              />
            </div>

            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input {...field} type="email" placeholder="user@example.com" />
                  <FieldError>{errors.email?.message}</FieldError>
                </Field>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Пароль</FieldLabel>
                  <div className="flex gap-2">
                    <Input {...field} placeholder="Минимум 8 символов" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Сгенерировать пароль"
                      onClick={generatePassword}
                    >
                      <Dices className="size-4" />
                    </Button>
                  </div>
                  <FieldError>{errors.password?.message}</FieldError>
                </Field>
              )}
            />

            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Роль</FieldLabel>
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="user">user</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="owner">owner</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.role?.message}</FieldError>
                </Field>
              )}
            />
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline" />}>Отмена</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
