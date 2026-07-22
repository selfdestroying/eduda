'use client'

import { NumberInput } from '@/src/components/number-input'
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
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, MoreVertical, Pen, Trash } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useRateDeleteMutation, useRateUpdateMutation } from '../queries'
import { UpdateRateSchema, UpdateRateSchemaType } from '../schemas'
import type { RateWithCount } from '../types'

interface RateActionsProps {
  rate: RateWithCount
}

export default function RateActions({ rate }: RateActionsProps) {
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isDeleteDisabled, setIsDeleteDisabled] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  const { mutate: updateMutate, isPending: isUpdatePending } = useRateUpdateMutation()
  const { mutate: deleteMutate, isPending: isDeletePending } = useRateDeleteMutation()

  const isPending = isUpdatePending || isDeletePending

  const form = useForm<UpdateRateSchemaType>({
    resolver: zodResolver(UpdateRateSchema),
    defaultValues: {
      id: rate.id,
      name: rate.name,
      bid: rate.bid,
      bonusPerStudent: rate.bonusPerStudent,
      isApplyToLessons: true,
    },
  })

  const handleEdit = (data: UpdateRateSchemaType) => {
    updateMutate(data, {
      onSuccess: () => {
        setEditDialogOpen(false)
        setOpen(false)
      },
    })
  }

  const handleDelete = () => {
    deleteMutate(
      { id: rate.id },
      {
        onSuccess: () => {
          setDeleteDialogOpen(false)
          setOpen(false)
        },
      },
    )
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
      id: rate.id,
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
            <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || isDeleteDisabled || rate._count.teacherGroups > 0}
            >
              {isPending ? (
                <Loader className="animate-spin" />
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
                    <NumberInput id="form-rate-bid" {...field} onChange={field.onChange} />
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
                    <NumberInput id="form-rate-bonus" {...field} onChange={field.onChange} />
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
            <DialogClose render={<Button variant="secondary" />}>Отмена</DialogClose>
            <Button type="submit" form="rate-edit-form" disabled={isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
