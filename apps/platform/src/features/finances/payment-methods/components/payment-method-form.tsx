'use client'

import { NumberInput } from '@/src/components/number-input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Switch } from '@/src/components/ui/switch'
import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form'

interface PaymentMethodFormProps<T extends FieldValues> {
  form: UseFormReturn<T>
  formId: string
}

export default function PaymentMethodForm<T extends FieldValues>({
  form,
  formId,
}: PaymentMethodFormProps<T>) {
  return (
    <form id={formId}>
      <FieldGroup className="gap-2">
        <Controller
          control={form.control}
          name={'name' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>Название</FieldLabel>
              <Input
                id={`${formId}-name`}
                placeholder="Например: Наличные, Перевод"
                {...field}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'commission' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-commission`}>Комиссия (%)</FieldLabel>
              <NumberInput
                id={`${formId}-commission`}
                {...field}
                onChange={field.onChange}
                value={field.value ?? 0}
                aria-invalid={fieldState.invalid}
                allowDecimal
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'description' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-description`}>
                Описание <span className="text-muted-foreground">(необязательно)</span>
              </FieldLabel>
              <Input
                id={`${formId}-description`}
                placeholder="Краткое описание метода оплаты"
                {...field}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'isActive' as Path<T>}
          render={({ field }) => (
            <Field>
              <div className="flex items-center gap-2">
                <Switch
                  id={`${formId}-isActive`}
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                />
                <FieldLabel htmlFor={`${formId}-isActive`}>Активен</FieldLabel>
              </div>
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
