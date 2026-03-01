'use client'

import { Input } from '@/src/components/ui/input'
import { Controller, useForm } from 'react-hook-form'

import { memberRoleLabels } from '@/src/components/sidebar/nav-user'
import { Button } from '@/src/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/src/components/ui/sheet'
import { useMemberCreateMutation } from '@/src/data/member/member-create-mutation'
import { useSessionQuery } from '@/src/data/user/session-query'
import { useIsMobile } from '@/src/hooks/use-mobile'
import { CreateUserSchema, CreateUserSchemaType } from '@/src/schemas/user'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function CreateUserDialog() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const isMobile = useIsMobile()
  const { data: session } = useSessionQuery()
  const { mutate, isPending } = useMemberCreateMutation()
  const form = useForm<CreateUserSchemaType>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      password: '',
      role: undefined,
    },
  })

  const onSubmit = (values: CreateUserSchemaType) => {
    mutate(
      {
        userParams: {
          email: values.email,
          name: `${values.firstName} ${values.lastName}`,
          password: values.password,
          role: 'user',
          data: {
            firstName: values.firstName,
            lastName: values.lastName,
          },
        },
        memberRole: values.role,
        organizationId: session!.organizationId!.toString(),
      },
      {
        onSuccess: () => {
          toast.success('Сотрудник успешно создан')
          setDialogOpen(false)
          form.reset()
        },
        onError: () => {
          toast.error('Ошибка при создании сотрудника')
          setDialogOpen(false)
          form.reset()
        },
      },
    )
  }

  return (
    <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
      <SheetTrigger render={<Button size={'icon'} />}>
        <Plus />
      </SheetTrigger>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="data-[side=bottom]:max-h-[70vh]"
      >
        <SheetHeader>
          <SheetTitle>Создать пользователя</SheetTitle>
          <SheetDescription>
            Заполните форму ниже, чтобы создать нового пользователя.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          id="create-user-form"
          className="no-scrollbar overflow-auto px-6 py-2"
        >
          <FieldGroup className="no-scrollbar max-h-[60vh] overflow-y-auto">
            <Controller
              control={form.control}
              name="firstName"
              disabled={isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="firstName-field">Имя</FieldLabel>
                  <Input id="firstName-field" {...field} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="lastName"
              disabled={isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="lastName-field">Фамилия</FieldLabel>
                  <Input id="lastName-field" {...field} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="email-field">Почта</FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    type="email"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="password"
              disabled={isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <div className="flex w-full items-center justify-between">
                    <FieldLabel htmlFor="password-field">Пароль</FieldLabel>
                  </div>
                  <Input id="password-field" {...field} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="role"
              disabled={isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="roleId-field">Роль</FieldLabel>
                  <Select
                    {...field}
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    itemToStringLabel={(itemValue) => memberRoleLabels[itemValue]}
                  >
                    <SelectTrigger id="roleId-field" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={'manager'}>Менеджер</SelectItem>
                        <SelectItem value={'teacher'}>Учитель</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
          <Button type="submit" form="create-user-form" disabled={isPending}>
            {isPending && <Loader className="animate-spin" />}
            Создать
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
