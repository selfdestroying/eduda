'use client'
import { Category } from '@/prisma/generated/client'
import { createProduct } from '@/src/actions/products'
import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Textarea } from '@/src/components/ui/textarea'
import { useSessionQuery } from '@/src/data/user/session-query'
import { CreateProductSchema, CreateProductSchemaType } from '@/src/schemas/product'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, Plus } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

export default function AddProductButton({ categories }: { categories: Category[] }) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId ?? undefined
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const form = useForm<CreateProductSchemaType>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      name: undefined,
      category: undefined,
      price: undefined,
      description: undefined,
      quantity: undefined,
      image: undefined,
    },
  })
  const onSubmit = (values: CreateProductSchemaType) => {
    startTransition(() => {
      const { category, image, ...payload } = values
      const ok = createProduct(
        {
          data: {
            ...payload,
            categoryId: Number(category.value),
            organizationId,
          },
        },
        image
      )
      toast.promise(ok, {
        loading: 'Создание продукта...',
        success: 'Продукт успешно создан!',
        error: 'Ошибка при создании продукта.',
        finally: () => {
          form.reset()
          setDialogOpen(false)
        },
      })
    })
  }

  const mappedCategories = useMemo(
    () =>
      categories.map((category) => ({
        label: category.name,
        value: category.id.toString(),
      })),
    [categories]
  )

  if (isSessionLoading) {
    return <Skeleton className="animate-spin" />
  }
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger render={<Button size={'icon'} />}>
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить продукт</DialogTitle>
          <DialogDescription>Создайте новый продукт</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} id="create-product-form">
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="name-field">Название</FieldLabel>
                  <Input
                    id="name-field"
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
              name="price"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="price-field">Цена</FieldLabel>
                  <Input
                    id="price-field"
                    type="number"
                    placeholder="Введите цену продукта"
                    aria-invalid={fieldState.invalid}
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="quantity"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="quantity-field">Количество</FieldLabel>
                  <Input
                    id="quantity-field"
                    type="number"
                    placeholder="Введите количество продукта"
                    aria-invalid={fieldState.invalid}
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="category"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="category-field">Категория</FieldLabel>
                  <Select
                    items={mappedCategories}
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    isItemEqualToValue={(itemValue, value) => itemValue.value === value.value}
                  >
                    <SelectTrigger id="category-field" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {mappedCategories.map((category) => (
                          <SelectItem key={category.value} value={category}>
                            {category.label}
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
              name="description"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="description-field">Описание</FieldLabel>
                  <Textarea
                    id="description-field"
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
              name="image"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="image-field">Изображение</FieldLabel>
                  <Input
                    id="image-field"
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
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button type="submit" form="create-product-form" disabled={isPending}>
            {isPending && <Loader className="animate-spin" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
