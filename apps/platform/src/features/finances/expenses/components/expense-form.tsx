'use client'

import { NumberInput } from '@/src/components/number-input'
import { Button } from '@/src/components/ui/button'
import { Calendar } from '@/src/components/ui/calendar'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { dateToYmd, ymdToLocalDate } from '@/src/lib/timezone'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form'

interface ExpenseFormProps<T extends FieldValues> {
  form: UseFormReturn<T>
  formId: string
}

export default function ExpenseForm<T extends FieldValues>({ form, formId }: ExpenseFormProps<T>) {
  return (
    <form id={formId}>
      <FieldGroup>
        {/* Название */}
        <Controller
          control={form.control}
          name={'name' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>Название</FieldLabel>
              <Input
                id={`${formId}-name`}
                placeholder="Например: Канцелярия, Хозтовары"
                {...field}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Сумма */}
        <Controller
          control={form.control}
          name={'amount' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-amount`}>Сумма (₽)</FieldLabel>
              <NumberInput
                id={`${formId}-amount`}
                placeholder="0"
                {...field}
                onChange={field.onChange}
                value={field.value ?? ''}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Дата */}
        <Controller
          control={form.control}
          name={'date' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>Дата</FieldLabel>
              <Popover>
                <PopoverTrigger
                  render={<Button variant="outline" className="w-full font-normal" />}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {field.value
                    ? format(ymdToLocalDate(field.value as string), 'd MMM yyyy', { locale: ru })
                    : 'Выберите дату'}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? ymdToLocalDate(field.value as string) : undefined}
                    onSelect={(value) => value && field.onChange(dateToYmd(value))}
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Комментарий */}
        <Controller
          control={form.control}
          name={'comment' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-comment`}>
                Комментарий <span className="text-muted-foreground">(необязательно)</span>
              </FieldLabel>
              <Input
                id={`${formId}-comment`}
                placeholder="Необязательный комментарий"
                {...field}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
