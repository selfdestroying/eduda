'use client'

import { Rate } from '@/prisma/generated/client'
import { createGroupType } from '@/src/actions/group-types'
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
import { CreateGroupTypeSchema, CreateGroupTypeSchemaType } from '@/src/schemas/group-type'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface CreateGroupTypeDialogProps {
  organizationId: number
  rates: Rate[]
}

export default function CreateGroupTypeDialog({
  organizationId,
  rates,
}: CreateGroupTypeDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<CreateGroupTypeSchemaType>({
    resolver: zodResolver(CreateGroupTypeSchema),
    defaultValues: {
      name: '',
      rateId: undefined,
    },
  })

  const onSubmit = (values: CreateGroupTypeSchemaType) => {
    startTransition(() => {
      const ok = createGroupType({
        data: {
          ...values,
          organizationId,
        },
      })
      toast.promise(ok, {
        loading: 'Создание типа группы...',
        success: 'Тип группы успешно создан!',
        error: 'Не удалось создать тип группы.',
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
          <DialogTitle>Создать тип группы</DialogTitle>
          <DialogDescription>
            Создайте новый тип группы и привяжите к нему ставку.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} id="create-group-type-form">
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Название</FieldLabel>
                  <Input
                    placeholder="Например: Группа"
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="rateId"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Ставка</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value?.toString() || ''}
                    onValueChange={(value) => field.onChange(Number(value))}
                    itemToStringLabel={(itemValue) =>
                      rates.find((r) => r.id === Number(itemValue))?.name || ''
                    }
                  >
                    <SelectTrigger aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Выберите ставку" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {rates.map((rate) => (
                          <SelectItem key={rate.id} value={rate.id.toString()}>
                            {rate.name} ({rate.bid} ₽
                            {rate.bonusPerStudent > 0 ? ` + ${rate.bonusPerStudent} ₽/уч.` : ''})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button type="submit" form="create-group-type-form" disabled={isPending}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
