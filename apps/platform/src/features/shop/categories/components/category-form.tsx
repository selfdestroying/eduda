'use client'

import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Controller, FieldValues, Path, UseFormReturn } from 'react-hook-form'

interface CategoryFormProps<T extends FieldValues> {
  form: UseFormReturn<T>
  formId: string
}

export default function CategoryForm<T extends FieldValues>({
  form,
  formId,
}: CategoryFormProps<T>) {
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
                placeholder="Введите название категории"
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
