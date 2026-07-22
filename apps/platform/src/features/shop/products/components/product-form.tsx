'use client'

import { CustomCombobox } from '@/src/components/custom-combobox'
import { NumberInput } from '@/src/components/number-input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import Image from 'next/image'
import { useEffect, useMemo } from 'react'
import { Controller, FieldValues, Path, UseFormReturn } from 'react-hook-form'

type MappedCategory = { label: string; value: string }

interface ProductFormProps<T extends FieldValues> {
  form: UseFormReturn<T>
  formId: string
  categories: MappedCategory[]
  existingImageUrl?: string
}

export default function ProductForm<T extends FieldValues>({
  form,
  formId,
  categories,
  existingImageUrl,
}: ProductFormProps<T>) {
  const watchedImage: unknown = form.watch('image' as Path<T>)

  const imagePreview = useMemo(() => {
    if (watchedImage instanceof File) {
      return URL.createObjectURL(watchedImage)
    }
    return null
  }, [watchedImage])

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const previewSrc = imagePreview ?? existingImageUrl

  return (
    <form id={formId}>
      <FieldGroup>
        {previewSrc && (
          <div className="relative h-20 w-20 overflow-hidden rounded-lg border">
            <Image src={previewSrc} alt="Превью" fill className="object-cover" sizes="80px" />
          </div>
        )}
        <Controller
          control={form.control}
          name={'name' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>Название</FieldLabel>
              <Input
                id={`${formId}-name`}
                placeholder="Введите название продукта"
                aria-invalid={fieldState.invalid}
                {...field}
                value={field.value ?? ''}
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
              <FieldLabel htmlFor={`${formId}-price`}>Цена</FieldLabel>
              <NumberInput
                id={`${formId}-price`}
                placeholder="Введите цену продукта"
                aria-invalid={fieldState.invalid}
                {...field}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'quantity' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-quantity`}>Количество</FieldLabel>
              <NumberInput
                id={`${formId}-quantity`}
                placeholder="Введите количество продукта"
                aria-invalid={fieldState.invalid}
                {...field}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'categoryId' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-category`}>Категория</FieldLabel>
              <CustomCombobox
                items={categories}
                value={categories.find((c) => c.value === field.value?.toString()) ?? null}
                onValueChange={(item: MappedCategory | null) => {
                  field.onChange(item ? Number(item.value) : undefined)
                }}
                id={`${formId}-category`}
                placeholder="Выберите категорию"
                emptyText="Не найдены категории"
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
              <FieldLabel htmlFor={`${formId}-description`}>Описание</FieldLabel>
              <Textarea
                id={`${formId}-description`}
                placeholder="Введите описание продукта"
                aria-invalid={fieldState.invalid}
                {...field}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'image' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-image`}>Изображение</FieldLabel>
              <Input
                id={`${formId}-image`}
                type="file"
                accept="image/png, image/jpeg, image/svg+xml, image/webp"
                aria-invalid={fieldState.invalid}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  field.onChange(file)
                }}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
