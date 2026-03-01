'use client'

import { Prisma } from '@/prisma/generated/client'
import { deleteRate, updateRate } from '@/src/actions/rates'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog'
import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogClose,
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Switch } from '@/src/components/ui/switch'
import { EditRateSchema, EditRateSchemaType } from '@/src/schemas/rate'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MoreVertical, Pen, Trash } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

type RateWithCount = Prisma.RateGetPayload<{
  include: { _count: { select: { teacherGroups: true } } }
}>

interface RateActionsProps {
  rate: RateWithCount
}

export default function RateActions({ rate }: RateActionsProps) {
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleteDisabled, setIsDeleteDisabled] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  const form = useForm<EditRateSchemaType>({
    resolver: zodResolver(EditRateSchema),
    defaultValues: {
      name: rate.name,
      bid: rate.bid,
      bonusPerStudent: rate.bonusPerStudent,
      isApplyToLessons: true,
    },
  })

  const handleEdit = (data: EditRateSchemaType) => {
    startTransition(() => {
      const { isApplyToLessons, ...payload } = data
      const ok = updateRate(
        {
          where: { id: rate.id },
          data: payload,
        },
        isApplyToLessons,
      )
      toast.promise(ok, {
        loading: 'Обновление ставки...',
        success: 'Ставка успешно обновлена',
        error: 'Ошибка при обновлении ставки',
        finally: () => {
          setEditDialogOpen(false)
          setOpen(false)
        },
      })
    })
  }

  const handleDelete = () => {
    startTransition(() => {
      const ok = deleteRate({ where: { id: rate.id } })
      toast.promise(ok, {
        loading: 'Удаление ставки...',
        success: 'Ставка удалена',
        error:
          rate._count.teacherGroups > 0
            ? 'Невозможно удалить ставку, которая используется в группах'
            : 'Ошибка при удалении ставки',
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

  useEffect(() => {
    form.reset({
      name: rate.name,
      bid: rate.bid,
      bonusPerStudent: rate.bonusPerStudent,
      isApplyToLessons: true,
    })
  }, [form, editDialogOpen, rate])

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" />}>
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-max">
          <DropdownMenuItem
            onClick={() => {
              setEditDialogOpen(true)
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
            <AlertDialogMedia>
              <Trash />
            </AlertDialogMedia>
            <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены что хотите удалить ставку <b>{rate.name}</b>?
              {rate._count.teacherGroups > 0 && (
                <>
                  {' '}
                  Эта ставка используется в {rate._count.teacherGroups} группе(ах). Сначала
                  переназначьте ставки в этих группах.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || isDeleteDisabled || rate._count.teacherGroups > 0}
              size="sm"
            >
              {isPending ? (
                <Loader2 className="animate-spin" />
              ) : isDeleteDisabled && deleteCountdown > 0 ? (
                `${deleteCountdown} с`
              ) : (
                'Удалить'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать ставку</DialogTitle>
            <DialogDescription>{rate.name}</DialogDescription>
          </DialogHeader>

          <form id="rate-edit-form" onSubmit={form.handleSubmit(handleEdit)}>
            <FieldGroup className="gap-2">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor="form-rate-name">Название</FieldLabel>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                    <Input id="form-rate-name" {...field} />
                  </Field>
                )}
              />

              <Controller
                name="bid"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor="form-rate-bid">Ставка за урок (₽)</FieldLabel>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                    <Input
                      id="form-rate-bid"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </Field>
                )}
              />

              <Controller
                name="bonusPerStudent"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor="form-rate-bonus">Бонус за ученика (₽)</FieldLabel>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                    <Input
                      id="form-rate-bonus"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </Field>
                )}
              />

              <Controller
                name="isApplyToLessons"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="toggle-apply-rate-to-lessons">
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>Применить к будущим урокам</FieldTitle>
                          <FieldDescription className="text-muted-foreground text-xs">
                            Обновит ставки во всех будущих уроках, привязанных к этой ставке
                          </FieldDescription>
                        </FieldContent>
                        <Switch
                          id="toggle-apply-rate-to-lessons"
                          name={field.name}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </Field>
                    </FieldLabel>
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <DialogFooter>
            <DialogClose render={<Button variant="secondary" size="sm" />}>Отмена</DialogClose>
            <Button type="submit" size="sm" form="rate-edit-form" disabled={isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
