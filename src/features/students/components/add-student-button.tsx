'use client'

import { CustomCombobox } from '@/src/components/custom-combobox'
import { Button } from '@/src/components/ui/button'
import { Calendar } from '@/src/components/ui/calendar'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { normalizeDateOnly } from '@/src/lib/timezone'
import { getAgeFromBirthDate } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { ru } from 'date-fns/locale'
import { CalendarIcon, Loader, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useParentListQuery } from '../../parents/queries'
import { ParentWithStudents } from '../../parents/types'
import { useStudentCreateMutation } from '../queries'
import { CreateStudentSchema, CreateStudentSchemaType } from '../schemas'

function RequiredMark() {
  return <span className="text-destructive">*</span>
}

function OptionalMark() {
  return <span className="text-muted-foreground text-xs font-normal">(необязательно)</span>
}

export default function AddStudentButton() {
  const { data: permission } = useOrganizationPermissionQuery({ student: ['create'] })
  const [dialogOpen, setDialogOpen] = useState(false)
  const createMutation = useStudentCreateMutation()
  const { data: parents = [] } = useParentListQuery()

  const form = useForm<CreateStudentSchemaType>({
    resolver: zodResolver(CreateStudentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      birthDate: undefined,
      url: undefined,
      parentMode: 'none',
      newParent: undefined,
      existingParentId: undefined,
    },
  })

  const tz = useOrgTimezone()
  const selectedBirthDate = form.watch('birthDate')
  const parentMode = form.watch('parentMode')
  const calculatedAge =
    selectedBirthDate instanceof Date && !isNaN(selectedBirthDate.getTime())
      ? getAgeFromBirthDate(normalizeDateOnly(selectedBirthDate), tz)
      : null

  const onSubmit = (values: CreateStudentSchemaType) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        form.reset()
        setDialogOpen(false)
      },
    })
  }

  const handleParentTabChange = (value: string | number | null) => {
    const mode = (value as string) ?? 'none'
    form.setValue('parentMode', mode as 'none' | 'new' | 'existing')
    if (mode === 'none') {
      form.setValue('newParent', undefined)
      form.setValue('existingParentId', undefined)
    } else if (mode === 'new') {
      form.setValue('existingParentId', undefined)
    } else if (mode === 'existing') {
      form.setValue('newParent', undefined)
    }
  }

  const selectedParent = parents.find((p) => p.id === form.watch('existingParentId')) ?? null

  if (!permission?.success) return null

  return (
    <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
      <SheetTrigger render={<Button size="icon" />}>
        <Plus />
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Создать ученика</SheetTitle>
          <SheetDescription>Заполните форму ниже, чтобы создать нового ученика.</SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          id="create-student-form"
          className="no-scrollbar overflow-auto px-6"
        >
          <FieldGroup>
            <Controller
              control={form.control}
              name="firstName"
              disabled={createMutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="firstName-field">
                    Имя <RequiredMark />
                  </FieldLabel>
                  <Input
                    id="firstName-field"
                    placeholder="Введите имя"
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
              disabled={createMutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="lastName-field">
                    Фамилия <RequiredMark />
                  </FieldLabel>
                  <Input
                    id="lastName-field"
                    placeholder="Введите фамилию"
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <FieldSeparator>Дополнительно</FieldSeparator>

            <Controller
              control={form.control}
              name="birthDate"
              disabled={createMutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="birthDate-field">
                    Дата рождения <OptionalMark />
                  </FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      render={<Button variant="outline" className="w-full font-normal" />}
                    >
                      <CalendarIcon />
                      {field.value
                        ? field.value.toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                          })
                        : 'Выберите дату'}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        onSelect={field.onChange}
                        locale={ru}
                        selected={field.value ?? undefined}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                  <FieldDescription>
                    {calculatedAge !== null && `Возраст: ${calculatedAge}`}
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="url"
              disabled={createMutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="url-field">
                    Ссылка <OptionalMark />
                  </FieldLabel>
                  <Input
                    id="url-field"
                    placeholder="https://"
                    {...field}
                    aria-invalid={fieldState.invalid}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                  />
                  <FieldDescription>CRM или мессенджер</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <FieldSeparator>Родитель</FieldSeparator>

            <Tabs defaultValue="none" value={parentMode} onValueChange={handleParentTabChange}>
              <TabsList className="w-full">
                <TabsTrigger value="none">Без родителя</TabsTrigger>
                <TabsTrigger value="new">Новый</TabsTrigger>
                <TabsTrigger value="existing">Существующий</TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="mt-3">
                <FieldGroup>
                  <Controller
                    control={form.control}
                    name="newParent.firstName"
                    disabled={createMutation.isPending}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="parent-firstName-field">
                          Имя родителя <RequiredMark />
                        </FieldLabel>
                        <Input
                          id="parent-firstName-field"
                          placeholder="Введите имя"
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
                    name="newParent.lastName"
                    disabled={createMutation.isPending}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="parent-lastName-field">
                          Фамилия родителя <OptionalMark />
                        </FieldLabel>
                        <Input
                          id="parent-lastName-field"
                          placeholder="Введите фамилию"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="newParent.phone"
                    disabled={createMutation.isPending}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="parent-phone-field">
                          Телефон <OptionalMark />
                        </FieldLabel>
                        <Input
                          id="parent-phone-field"
                          type="tel"
                          placeholder="+7 (999) 123-45-67"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="newParent.email"
                    disabled={createMutation.isPending}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="parent-email-field">
                          Email <OptionalMark />
                        </FieldLabel>
                        <Input
                          id="parent-email-field"
                          type="email"
                          placeholder="parent@example.com"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </TabsContent>

              <TabsContent value="existing" className="mt-3">
                <Field>
                  <FieldLabel>Выберите родителя</FieldLabel>
                  <CustomCombobox<ParentWithStudents>
                    items={parents}
                    value={selectedParent}
                    onValueChange={(item) =>
                      form.setValue('existingParentId', item?.id ?? undefined, {
                        shouldValidate: true,
                      })
                    }
                    getLabel={(p) => [p.firstName, p.lastName].filter(Boolean).join(' ')}
                    getKey={(p) => p.id}
                    placeholder="Поиск по имени или телефону..."
                    disabled={createMutation.isPending}
                    renderItem={(p) => (
                      <Item size="xs" className="p-0">
                        <ItemContent>
                          <ItemTitle className="whitespace-nowrap">
                            {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                          </ItemTitle>
                          <ItemDescription>
                            <span>
                              {p.phone
                                ? `+${p.phone.replace(/\D/g, '').slice(-11)}`
                                : 'Нет телефона'}
                            </span>
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    )}
                  />
                  {form.formState.errors.existingParentId && (
                    <FieldError errors={[form.formState.errors.existingParentId]} />
                  )}
                </Field>
              </TabsContent>
            </Tabs>
          </FieldGroup>
        </form>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
          <Button type="submit" form="create-student-form" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader className="animate-spin" />}
            Создать
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
