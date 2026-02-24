'use client'

import { Input } from '@/src/components/ui/input'
import { Controller, useForm } from 'react-hook-form'

import { Prisma } from '@/prisma/generated/client'
import { updateUser } from '@/src/actions/users'
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
import { useIsMobile } from '@/src/hooks/use-mobile'
import { OrganizationRole } from '@/src/lib/auth'
import { authClient } from '@/src/lib/auth-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pen } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { z } from 'zod/v4'

interface EditUserButtonProps {
  member: Prisma.MemberGetPayload<{ include: { user: true } }>
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}

const EditUserSchema = z.object({
  firstName: z.string().min(2, 'Укажите имя'),
  lastName: z.string().optional(),
  role: z.object(
    {
      label: z.string(),
      value: z.string(),
    },
    'Выберите роль'
  ),
  banned: z.boolean(),
})

type EditUserSchemaType = z.infer<typeof EditUserSchema>

const mappedRoles = [
  { label: 'Менеджер', value: 'manager' },
  { label: 'Учитель', value: 'teacher' },
]

export default function EditUserButton({
  member,
  variant = 'default',
  size = 'icon',
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
}: EditUserButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [internalOpen, setInternalOpen] = useState(false)
  const isMobile = useIsMobile()

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setIsOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const form = useForm<EditUserSchemaType>({
    resolver: zodResolver(EditUserSchema),
    defaultValues: {
      firstName: member.user.name?.split(' ')[0] || '',
      lastName: member.user.name?.split(' ').slice(1).join(' ') || undefined,
      role: member.user.role
        ? { label: memberRoleLabels[member.role as OrganizationRole], value: member.role }
        : undefined,
      banned: member.user.banned !== null ? member.user.banned : undefined,
    },
  })

  const onSubmit = (values: EditUserSchemaType) => {
    startTransition(() => {
      const { role, firstName, lastName, ...payload } = values
      const ok = updateUser({
        where: { id: member.user.id },
        data: {
          ...payload,
          name: `${firstName} ${lastName || ''}`.trim(),
        },
      }).then(() =>
        authClient.organization.updateMemberRole({
          memberId: member.id.toString(),
          role: role.value,
        })
      )
      toast.promise(ok, {
        loading: 'Обновление пользователя...',
        success: 'Пользователь успешно обновлен!',
        error: 'Не удалось обновить пользователя. Пожалуйста, попробуйте еще раз.',
        finally: () => {
          setIsOpen(false)
        },
      })
    })
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {showTrigger && (
        <SheetTrigger
          render={
            <Button size={size} variant={variant}>
              <Pen />
            </Button>
          }
        />
      )}
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="data-[side=bottom]:max-h-[70vh]"
      >
        <SheetHeader>
          <SheetTitle>Редактировать пользователя</SheetTitle>
          <SheetDescription>Измените информацию о пользователе ниже.</SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          id="edit-user-form"
          className="no-scrollbar overflow-y-auto px-4"
        >
          <FieldGroup>
            <Controller
              control={form.control}
              name="firstName"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Имя</FieldLabel>
                  <Input
                    placeholder="Введите имя"
                    type="text"
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="lastName"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Фамилия</FieldLabel>
                  <Input
                    placeholder="Введите фамилию"
                    type="text"
                    {...field}
                    value={field.value ?? ''}
                    aria-invalid={fieldState.invalid}
                  />
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
                    items={mappedRoles}
                    value={field.value}
                    onValueChange={field.onChange}
                    isItemEqualToValue={(itemValue, value) => itemValue.value == value.value}
                  >
                    <SelectTrigger id="roleId-field" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {mappedRoles.map((role) => (
                          <SelectItem key={role.value} value={role}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="banned"
              disabled={isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="banned-field">Статус</FieldLabel>
                  <Select
                    {...field}
                    value={field.value}
                    itemToStringLabel={(itemValue) => (itemValue ? 'Неактивен' : 'Активен')}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="banned-field" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Выберите статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem key={1} value={false}>
                          Активен
                        </SelectItem>
                        <SelectItem key={0} value={true}>
                          Неактивен
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <SheetFooter className="border-t px-6 py-4">
          <SheetClose render={<Button type="button" variant="outline" />}>Отмена</SheetClose>
          <Button disabled={isPending} type="submit" form="edit-user-form">
            Сохранить
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
