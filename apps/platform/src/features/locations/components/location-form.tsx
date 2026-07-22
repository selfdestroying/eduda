'use client'

import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Controller, FieldValues, Path, UseFormReturn } from 'react-hook-form'

interface LocationFormProps<T extends FieldValues> {
  form: UseFormReturn<T>
  formId: string
}

export default function LocationForm<T extends FieldValues>({
  form,
  formId,
}: LocationFormProps<T>) {
  return (
    <form id={formId}>
      <FieldGroup>
        <Controller
          control={form.control}
          name={'name' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>Название</FieldLabel>
              <Input
                id={`${formId}-name`}
                placeholder="Введите название локации"
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
