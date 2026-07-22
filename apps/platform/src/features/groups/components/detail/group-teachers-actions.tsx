'use client'

import { CustomCombobox } from '@/src/components/custom-combobox'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
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
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Switch } from '@/src/components/ui/switch'
import { useRateListQuery } from '@/src/features/organization/rates/queries'
import { Loader, MoreVertical, Pen, Trash } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useEditTeacherGroupMutation, useRemoveTeacherFromGroupMutation } from '../../queries'
import type { TeacherGroupWithRate } from '../../types'

import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const EditRateFormSchema = z.object({
  rateId: z.number('Выберите ставку').int().positive('Выберите ставку'),
  isApplyToLessons: z.boolean(),
})
type EditRateFormValues = z.infer<typeof EditRateFormSchema>

interface UsersActionsProps {
  tg: TeacherGroupWithRate
}

export default function GroupTeacherActions({ tg }: UsersActionsProps) {
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isDeleteFromLessons, setIsDeleteFromLessons] = useState(true)
  const [isDeleteDisabled, setIsDeleteDisabled] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  const { data: rates, isLoading: isRatesLoading } = useRateListQuery()
  const editMutation = useEditTeacherGroupMutation()
  const removeMutation = useRemoveTeacherFromGroupMutation()

  const form = useForm<EditRateFormValues>({
    resolver: zodResolver(EditRateFormSchema),
    defaultValues: {
      rateId: tg.rateId,
      isApplyToLessons: true,
    },
  })

  const handleEdit = (data: EditRateFormValues) => {
    editMutation.mutate(
      {
        teacherId: tg.teacherId,
        groupId: tg.groupId,
        rateId: data.rateId,
        isApplyToLessons: data.isApplyToLessons,
      },
      {
        onSuccess: () => {
          setEditDialogOpen(false)
          setOpen(false)
          setIsDeleteFromLessons(false)
        },
      },
    )
  }

  const handleDelete = () => {
    removeMutation.mutate(
      {
        teacherId: tg.teacherId,
        groupId: tg.groupId,
        isApplyToLessons: isDeleteFromLessons,
      },
      {
        onSuccess: () => {
          setDeleteDialogOpen(false)
          setOpen(false)
          setIsDeleteFromLessons(false)
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
    form.reset({ rateId: tg.rateId, isApplyToLessons: true })
  }, [form, editDialogOpen, tg.rateId])

  const selectedRate = rates?.find((r) => r.id === form.watch('rateId'))
  const isPending = editMutation.isPending || removeMutation.isPending

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
            <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены что хотите удалить <b>{tg.teacher.name}</b> из списка преподавателей?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <FieldLabel htmlFor="toggle-apply-to-lessons-delete">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Применить к урокам</FieldTitle>
                <FieldDescription>
                  Удалит преподавателя из всех будущих уроков, привязанных к этой группе
                </FieldDescription>
              </FieldContent>
              <Switch
                id="toggle-apply-to-lessons-delete"
                checked={isDeleteFromLessons}
                onCheckedChange={(checked) => setIsDeleteFromLessons(Boolean(checked))}
              />
            </Field>
          </FieldLabel>

          <AlertDialogFooter>
            <Button variant={'secondary'} onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || isDeleteDisabled}
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
            <DialogTitle>Редактировать</DialogTitle>
            <DialogDescription>{tg.teacher.name}</DialogDescription>
          </DialogHeader>

          <form id="teacher-group-edit-form" onSubmit={form.handleSubmit(handleEdit)}>
            <FieldGroup className="gap-2">
              <Controller
                name="rateId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor="form-rhf-select-rate">Ставка</FieldLabel>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                    {isRatesLoading ? (
                      <Skeleton className="h-9 w-full" />
                    ) : (
                      <CustomCombobox
                        id="form-rhf-select-rate"
                        items={rates || []}
                        getKey={(r) => r.id}
                        getLabel={(r) => r.name}
                        value={rates?.find((r) => r.id === field.value) || null}
                        onValueChange={(r) => r && field.onChange(r.id)}
                        placeholder="Выберите ставку"
                        emptyText="Не найдены ставки"
                        renderItem={(r) => (
                          <Item size="xs" className="p-0">
                            <ItemContent>
                              <ItemTitle className="whitespace-nowrap tabular-nums">
                                {r.name}
                              </ItemTitle>
                              <ItemDescription>
                                <span className="tabular-nums">
                                  {r.bid} ₽ | {r.bonusPerStudent} ₽/ученик
                                </span>
                              </ItemDescription>
                            </ItemContent>
                          </Item>
                        )}
                      />
                    )}
                    {selectedRate && (
                      <p className="text-muted-foreground text-xs">
                        {selectedRate.bid} ₽ за урок
                        {selectedRate.bonusPerStudent > 0 &&
                          ` + ${selectedRate.bonusPerStudent} ₽ за ученика`}
                      </p>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="isApplyToLessons"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="toggle-apply-to-lessons">
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>Применить к урокам</FieldTitle>
                            <FieldDescription>
                              Добавит преподавателя во все будущие уроки, привязанные к этой группе
                            </FieldDescription>
                          </FieldContent>
                          <Switch
                            id="toggle-apply-to-lessons"
                            name={field.name}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </Field>
                      </FieldLabel>
                    </Field>
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Отмена</DialogClose>
            <Button type="submit" form="teacher-group-edit-form" disabled={isPending}>
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
