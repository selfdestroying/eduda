'use client'

import { Button } from '@/src/components/ui/button'
import { Calendar } from '@/src/components/ui/calendar'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { dateToYmd, formatDateOnly, ymdToLocalDate } from '@/src/lib/timezone'
import { zodResolver } from '@hookform/resolvers/zod'
import { ru } from 'date-fns/locale'
import { CalendarIcon, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useCreateLessonForGroupMutation } from '../../queries'
import type { CreateLessonForGroupSchemaType } from '../../schemas'
import { CreateLessonForGroupSchema } from '../../schemas'

interface AddLessonButtonProps {
  groupId: number
}

export default function AddLessonButton({ groupId }: AddLessonButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const createMutation = useCreateLessonForGroupMutation()

  const form = useForm<CreateLessonForGroupSchemaType>({
    resolver: zodResolver(CreateLessonForGroupSchema),
    defaultValues: {
      groupId,
      date: undefined,
      time: undefined,
    },
  })

  const handleSubmit = (values: CreateLessonForGroupSchemaType) => {
    createMutation.mutate(
      { ...values, groupId },
      {
        onSuccess: () => {
          setDialogOpen(false)
          form.reset()
        },
      },
    )
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger
        render={
          <Button size={'icon'}>
            <Plus />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить занятие</DialogTitle>
          <DialogDescription>Введите дату и время для нового занятия</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} id="add-lesson-form">
          <FieldGroup>
            <Controller
              control={form.control}
              name="date"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="lesson-date-field">Дата урока</FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className="w-full font-normal"
                          aria-invalid={fieldState.invalid}
                        />
                      }
                    >
                      <CalendarIcon />
                      {field.value
                        ? formatDateOnly(field.value, { day: 'numeric', month: 'long' })
                        : 'Выберите день'}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        onSelect={(d) => field.onChange(d ? dateToYmd(d) : undefined)}
                        locale={ru}
                        selected={field.value ? ymdToLocalDate(field.value) : undefined}
                      />
                    </PopoverContent>
                  </Popover>

                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="time"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="lesson-time-field">Время урока</FieldLabel>
                  <Input
                    id="lesson-time-field"
                    type="time"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant={'outline'}>Отмена</Button>} />
          <Button type="submit" form="add-lesson-form" disabled={createMutation.isPending}>
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
