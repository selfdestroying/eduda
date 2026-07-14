'use client'

import { Input } from '@/src/components/ui/input'
import { Controller, useForm } from 'react-hook-form'

import { CustomCombobox } from '@/src/components/custom-combobox'
import { Button } from '@/src/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
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
import { useAssignableRolesQuery } from '@/src/features/organization/roles/queries'
import { systemRoleLabels } from '@/src/lib/permissions/organization'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pen } from 'lucide-react'
import { useState } from 'react'
import { useMemberUpdateMutation } from '../queries'
import { UpdateMemberSchema, UpdateMemberSchemaType } from '../schemas'
import type { MemberWithUser } from '../types'

interface EditMemberDialogProps {
  member: MemberWithUser
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}

function roleLabel(role: string): string {
  return systemRoleLabels[role as keyof typeof systemRoleLabels] ?? role
}

export default function EditMemberDialog({
  member,
  variant = 'default',
  size = 'icon',
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
}: EditMemberDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isMobile = useIsMobile()
  const { mutate, isPending } = useMemberUpdateMutation()
  const { data: roles = [] } = useAssignableRolesQuery()
  const roleItems = roles.map((r) => ({ label: r.label, value: r.role }))

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setIsOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const form = useForm<UpdateMemberSchemaType>({
    resolver: zodResolver(UpdateMemberSchema),
    defaultValues: {
      memberId: member.id.toString(),
      userId: member.userId,
      firstName: member.user.name?.split(' ')[0] || '',
      lastName: member.user.name?.split(' ').slice(1).join(' ') || undefined,
      role: member.role ? { label: roleLabel(member.role), value: member.role } : undefined,
      banned: member.user.banned !== null ? member.user.banned : undefined,
    },
  })

  const onSubmit = (values: UpdateMemberSchemaType) => {
    mutate(values, {
      onSuccess: () => setIsOpen(false),
      onError: () => setIsOpen(false),
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
                  <CustomCombobox
                    items={roleItems}
                    value={field.value || null}
                    onValueChange={field.onChange}
                    isItemEqualToValue={(a, b) => a.value === b.value}
                    id="roleId-field"
                    placeholder="Выберите роль"
                    disabled={isPending}
                  />
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
                  <CustomCombobox
                    items={[
                      { label: 'Активен', value: false },
                      { label: 'Неактивен', value: true },
                    ]}
                    value={
                      field.value !== undefined
                        ? { label: field.value ? 'Неактивен' : 'Активен', value: field.value }
                        : null
                    }
                    onValueChange={(item) => item !== null && field.onChange(item.value)}
                    getKey={(item) => String(item.value)}
                    id="banned-field"
                    placeholder="Выберите статус"
                    disabled={isPending}
                  />
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
