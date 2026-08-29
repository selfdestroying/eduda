'use client'

import { formatCurrency } from '@/src/lib/utils'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldOptional,
} from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import { NumberInput } from '@repo/ui/components/number-input'
import { Switch } from '@repo/ui/components/switch'
import {
  Controller,
  useWatch,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from 'react-hook-form'

interface ProductFormProps<T extends FieldValues> {
  form: UseFormReturn<T>
  formId: string
}

export default function ProductForm<T extends FieldValues>({ form, formId }: ProductFormProps<T>) {
  const price = useWatch({ control: form.control, name: 'price' as Path<T> })
  const lessonCount = useWatch({ control: form.control, name: 'lessonCount' as Path<T> })

  // Честное деление с одной цифрой после запятой — тем же способом, что в форме
  // оплаты (`payments/components/package-form.tsx`): 6400 ₽ за 3 занятия не должны
  // показаться ровными 2133, иначе остаток от деления исчезает с экрана.
  const perLesson =
    typeof price === 'number' && typeof lessonCount === 'number' && lessonCount > 0
      ? price / lessonCount
      : null

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
                placeholder="Например: Абонемент 8 занятий"
                {...field}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'lessonCount' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-lessonCount`}>Количество занятий</FieldLabel>
              <NumberInput
                id={`${formId}-lessonCount`}
                {...field}
                value={field.value ?? ''}
                aria-invalid={fieldState.invalid}
                aria-required
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'price' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              {/* Цена за пакет целиком, как её объявляют родителю. Цена занятия из
                  неё выводится, а не наоборот. */}
              <FieldLabel htmlFor={`${formId}-price`}>Цена пакета</FieldLabel>
              <NumberInput
                id={`${formId}-price`}
                {...field}
                value={field.value ?? ''}
                aria-invalid={fieldState.invalid}
                aria-required
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                perLesson !== null && (
                  <FieldDescription>{formatCurrency(perLesson, 1)} за занятие</FieldDescription>
                )
              )}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'description' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-description`}>
                Описание <FieldOptional />
              </FieldLabel>
              <Input
                id={`${formId}-description`}
                placeholder="Краткое описание продукта"
                {...field}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'externalId' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-externalId`}>
                Номер товара в amoCRM <FieldOptional />
              </FieldLabel>
              <NumberInput
                id={`${formId}-externalId`}
                {...field}
                value={field.value ?? ''}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                // Номер видно в причине неразобранной оплаты: «Товар CRM 1784397
                // … не привязан ни к одному продукту» — оттуда его и переносят.
                <FieldDescription>
                  Оплаты этого товара разберутся сами. Номер показан в причине неразобранной оплаты
                </FieldDescription>
              )}
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
                <FieldLabel htmlFor={`${formId}-isActive`}>В продаже</FieldLabel>
              </div>
              {/* Продукт снимают с продажи, а не удаляют: на него ссылаются прошлые
                  оплаты, и в новых он просто перестаёт предлагаться. */}
              <FieldDescription>Снятый с продажи продукт не предлагается в оплате</FieldDescription>
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
