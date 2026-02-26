'use client'
import { createPaycheck } from '@/src/actions/paycheck'
import { Button } from '@/src/components/ui/button'
import { Calendar } from '@/src/components/ui/calendar'
import {
  Dialog,
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
import { zodResolver } from '@hookform/resolvers/zod'
import { ru } from 'date-fns/locale'
import { CalendarIcon, Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod/v4'

interface AddCheckButtonProps {
  organizationId: number
  userId: number
  userName: string
}

const AddCheckSchema = z.object({
  amount: z.number('Укажите корректную сумму').min(0, 'Сумма должна быть неотрицательной'),
  date: z.date('Укажите корректную дату'),
  comment: z.string('Укажите комментарий').max(255),
})

type AddCheckSchemaType = z.infer<typeof AddCheckSchema>

export default function AddCheckButton({ organizationId, userId, userName }: AddCheckButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<AddCheckSchemaType>({
    resolver: zodResolver(AddCheckSchema),
    defaultValues: {
      amount: undefined,
      date: undefined,
      comment: undefined,
    },
  })

  const onSubmit = (values: AddCheckSchemaType) => {
    startTransition(() => {
      const ok = createPaycheck({
        data: {
          organizationId,
          userId,
          ...values,
        },
      })
      toast.promise(ok, {
        loading: 'Добавление чека...',
        success: 'Чек успешно добавлен!',
        error: 'Ошибка при добавлении чека.',
        finally: () => {
          form.reset()
          setDialogOpen(false)
        },
      })
    })
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
          <DialogTitle>Добавить чек</DialogTitle>
          <DialogDescription>Добавить чек для {userName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} id="add-paycheck-form">
          <FieldGroup>
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Сумма</FieldLabel>
                  <Input
                    type="number"
                    placeholder="Сумма"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="date"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Дата</FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      render={<Button variant="outline" className="w-full font-normal" />}
                    >
                      <CalendarIcon />
                      {field.value
                        ? field.value.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
                        : 'Выберите день'}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        onSelect={field.onChange}
                        locale={ru}
                        selected={field.value}
                      />
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="comment"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Комментарий</FieldLabel>
                  <Input
                    type="text"
                    placeholder="Комментарий"
                    {...field}
                    value={field.value ?? ''}
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
          <Button variant="secondary" onClick={() => setDialogOpen(false)} size={'sm'}>
            Отмена
          </Button>
          <Button disabled={isPending} type="submit" form="add-paycheck-form" size={'sm'}>
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
