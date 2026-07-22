'use client'

import { Button } from '@/src/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
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
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { getAgeFromBirthDate } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, Pen } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useStudentUpdateMutation } from '../../queries'
import { EditStudentSchema, EditStudentSchemaType } from '../../schemas'
import type { StudentDetail } from '../../types'

function RequiredMark() {
  return <span className="text-destructive">*</span>
}

function OptionalMark() {
  return <span className="text-muted-foreground text-xs font-normal">(необязательно)</span>
}

export default function EditStudentDialog({ student }: { student: StudentDetail }) {
  const isMobile = useIsMobile()
  const [dialogOpen, setDialogOpen] = useState(false)
  const mutation = useStudentUpdateMutation(student.id)

  const form = useForm<EditStudentSchemaType>({
    resolver: zodResolver(EditStudentSchema),
    defaultValues: {
      firstName: student.firstName,
      lastName: student.lastName || '',
      birthDate: student.birthDate || undefined,
      url: student.url || '',
    },
  })

  const tz = useOrgTimezone()
  const selectedBirthDate = form.watch('birthDate')
  const calculatedAge = selectedBirthDate ? getAgeFromBirthDate(selectedBirthDate, tz) : null

  const onSubmit = (values: EditStudentSchemaType) => {
    // values.birthDate уже прогнан через DateOnlySchema (UTC-полночь) — не нормализуем повторно.
    const age = values.birthDate ? getAgeFromBirthDate(values.birthDate, tz) : null
    mutation.mutate(
      {
        payload: {
          where: { id: student.id },
          data: {
            firstName: values.firstName,
            lastName: values.lastName,
            age,
            birthDate: values.birthDate ?? null,
            url: values.url || null,
          },
        },
      },
      {
        onSuccess: () => setDialogOpen(false),
      },
    )
  }

  return (
    <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
      <SheetTrigger render={<Button size="icon" />}>
        <Pen />
      </SheetTrigger>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="data-[side=bottom]:max-h-[70vh]"
      >
        <SheetHeader>
          <SheetTitle>Редактировать ученика</SheetTitle>
          <SheetDescription>
            Заполните форму ниже, чтобы отредактировать данные ученика.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          id="edit-student-form"
          className="no-scrollbar overflow-y-auto px-4"
        >
          <FieldGroup>
            <Controller
              control={form.control}
              name="firstName"
              disabled={mutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="edit-firstName-field">
                    Имя <RequiredMark />
                  </FieldLabel>
                  <Input
                    id="edit-firstName-field"
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
              disabled={mutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="edit-lastName-field">
                    Фамилия <RequiredMark />
                  </FieldLabel>
                  <Input
                    id="edit-lastName-field"
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
              disabled={mutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="edit-birthDate-field">
                    Дата рождения <OptionalMark />
                  </FieldLabel>
                  <Input
                    id="edit-birthDate-field"
                    type="date"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    {calculatedAge !== null
                      ? `Возраст: ${calculatedAge}`
                      : 'Допустимый возраст: 6-17 лет'}
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="url"
              disabled={mutation.isPending}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="edit-url-field">
                    Ссылка <OptionalMark />
                  </FieldLabel>
                  <Input
                    id="edit-url-field"
                    placeholder="https://"
                    {...field}
                    aria-invalid={fieldState.invalid}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                  <FieldDescription>Профиль в соцсетях или мессенджере</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Отмена</SheetClose>
          <Button type="submit" form="edit-student-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader className="animate-spin" />}
            Сохранить
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
