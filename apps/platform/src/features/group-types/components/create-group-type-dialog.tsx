'use client'

import { CustomCombobox } from '@/src/components/custom-combobox'
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
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useGroupTypeCreateMutation, useRateListQuery } from '../queries'
import { CreateGroupTypeSchema, type CreateGroupTypeSchemaType } from '../schemas'

export default function CreateGroupTypeDialog() {
  const [open, setOpen] = useState(false)
  const { data: rates = [] } = useRateListQuery()
  const { mutate, isPending } = useGroupTypeCreateMutation()

  const form = useForm<CreateGroupTypeSchemaType>({
    resolver: zodResolver(CreateGroupTypeSchema),
    defaultValues: {
      name: '',
      rateId: undefined,
    },
  })

  const onSubmit = (values: CreateGroupTypeSchemaType) => {
    mutate(values, {
      onSuccess: () => {
        setOpen(false)
        form.reset()
      },
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
              name="rateId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldContent>
                    <FieldLabel htmlFor="form-rhf-select-rate">Ставка</FieldLabel>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </FieldContent>
                  <CustomCombobox
                    id="form-rhf-select-rate"
                    items={rates}
                    getKey={(r) => r.id}
                    getLabel={(r) => r.name}
                    value={rates.find((r) => r.id === field.value) || null}
                    onValueChange={(r) => r && field.onChange(r.id)}
                    placeholder="Выберите ставку"
                    emptyText="Не найдены ставки"
                    renderItem={(r) => (
                      <Item size="xs" className="p-0">
                        <ItemContent>
                          <ItemTitle className="whitespace-nowrap tabular-nums">{r.name}</ItemTitle>
                          <ItemDescription>
                            <span className="tabular-nums">
                              {r.bid} ₽ | {r.bonusPerStudent} ₽/ученик
                            </span>
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    )}
                  />
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
