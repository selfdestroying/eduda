'use client'
import { PayCheck } from '@/prisma/generated/client'
import { deletePaycheck, updatePaycheck } from '@/src/actions/paycheck'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog'
import { Button } from '@/src/components/ui/button'
import { Calendar, CalendarDayButton } from '@/src/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { CreatePaycheckSchema, CreatePaycheckSchemaType } from '@/src/schemas/paycheck'
import { zodResolver } from '@hookform/resolvers/zod'
import { ru } from 'date-fns/locale'
import { Loader2, MoreVertical, Pen, Trash } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface AddCheckButtonProps {
  paycheck: PayCheck
  userName: string
}

export default function PayCheckActions({ paycheck, userName }: AddCheckButtonProps) {
  const [open, setOpen] = useState<boolean>(false)
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [isDeleteDisabled, setIsDeleteDisabled] = useState<boolean>(false)
  const [deleteCountdown, setDeleteCountdown] = useState<number>(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false)

  const [isPending, startTransition] = useTransition()

  const form = useForm<CreatePaycheckSchemaType>({
    resolver: zodResolver(CreatePaycheckSchema),
    defaultValues: {
      amount: paycheck.amount,
      date: paycheck.date,
      comment: paycheck.comment,
    },
  })

  const onSubmit = (values: CreatePaycheckSchemaType) => {
    startTransition(() => {
      const ok = updatePaycheck({
        where: { id: paycheck.id },
        data: values,
      })
      toast.promise(ok, {
        loading: 'Редактирование чека...',
        success: 'Чек успешно отредактирован!',
        error: 'Ошибка при редактировании чека.',
        finally: () => {
          form.reset()
          setDialogOpen(false)
        },
      })
    })
  }

  const handleDelete = () => {
    startTransition(() => {
      const ok = deletePaycheck({
        where: {
          id: paycheck.id,
          userId: paycheck.userId,
        },
      })
      toast.promise(ok, {
        loading: 'Удаление чека...',
        success: 'Чек успешно удален',
        error: 'Ошибка при удалении чека',
        finally: () => {
          setDeleteDialogOpen(false)
          setOpen(false)
        },
      })
    })
  }

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    if (deleteDialogOpen) {
      intervalId = setInterval(() => {
        setDeleteCountdown((prev) => {
          if (prev <= 1) {
            setIsDeleteDisabled(false)
            if (intervalId) clearInterval(intervalId)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [deleteDialogOpen])

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" />}>
          <MoreVertical />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-max">
          <DropdownMenuItem
            onClick={() => {
              setDialogOpen(true)
              setOpen(false)
            }}
          >
            <Pen />
            Редактировать
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setDeleteCountdown(3)
              setIsDeleteDisabled(true)
              setDeleteDialogOpen(true)
              setOpen(false)
            }}
          >
            <Trash />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены что хотите удалить <b>Чек № {paycheck.id}</b> из списка преподавателей?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant={'secondary'} size={'sm'} onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || isDeleteDisabled}
              size={'sm'}
            >
              {isPending ? (
                <Loader2 className="animate-spin" />
              ) : isDeleteDisabled && deleteCountdown > 0 ? (
                `Удалить (${deleteCountdown}с)`
              ) : (
                'Удалить'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      locale={ru}
                      components={{
                        DayButton: (props) => (
                          <CalendarDayButton
                            {...props}
                            data-day={props.day.date.toLocaleDateString('ru-RU')}
                          />
                        ),
                      }}
                    />
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
    </>
  )
}
