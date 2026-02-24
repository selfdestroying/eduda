'use client'

import { createRate } from '@/src/actions/rates'
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
import { CreateRateSchema, CreateRateSchemaType } from '@/src/schemas/rate'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface CreateRateDialogProps {
  organizationId: number
}

export default function CreateRateDialog({ organizationId }: CreateRateDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<CreateRateSchemaType>({
    resolver: zodResolver(CreateRateSchema),
    defaultValues: {
      name: '',
      bid: 0,
      bonusPerStudent: 0,
    },
  })

  const onSubmit = (values: CreateRateSchemaType) => {
    startTransition(() => {
      const ok = createRate({
        data: {
          ...values,
          organizationId,
        },
      })
      toast.promise(ok, {
        loading: 'Создание ставки...',
        success: 'Ставка успешно создана!',
        error: 'Не удалось создать ставку.',
        finally: () => {
          setOpen(false)
          form.reset()
        },
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" />}>
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать ставку</DialogTitle>
          <DialogDescription>
            Создайте новую ставку для назначения преподавателям в группах.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} id="create-rate-form">
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Название</FieldLabel>
                  <Input
                    placeholder="Например: Стандартная"
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="bid"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Ставка за урок (₽)</FieldLabel>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="bonusPerStudent"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Бонус за ученика (₽)</FieldLabel>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button type="submit" form="create-rate-form" disabled={isPending}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
