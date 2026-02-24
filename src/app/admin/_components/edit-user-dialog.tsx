'use client'

import { updateUser } from '@/src/actions/users'
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
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Pencil } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import type { AdminUser } from './types'

const editUserSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  email: z.string().email('Некорректный email'),
})

type EditUserFormValues = z.infer<typeof editUserSchema>

interface EditUserDialogProps {
  user: AdminUser
  onSuccess: () => void
  disabled?: boolean
}

export default function EditUserDialog({ user, onSuccess, disabled }: EditUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
    },
  })

  const onSubmit = (values: EditUserFormValues) => {
    startTransition(async () => {
      try {
        await updateUser({
          where: { id: user.id },
          data: {
            name: values.name,
            email: values.email,
          },
        })
        toast.success('Пользователь обновлён')
        setOpen(false)
        onSuccess()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка при обновлении')
      }
    })
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      reset({
        name: user.name,
        email: user.email,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button size="icon" variant="ghost" title="Редактировать" disabled={disabled} />}
      >
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать пользователя</DialogTitle>
          <DialogDescription>
            {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-1 gap-3">
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Имя</FieldLabel>
                    <Input {...field} placeholder="Имя" />
                    <FieldError>{errors.name?.message}</FieldError>
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
                  <Input {...field} type="email" placeholder="Email" />
                  <FieldError>{errors.email?.message}</FieldError>
                </Field>
              )}
            />
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline" />}>Отмена</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
