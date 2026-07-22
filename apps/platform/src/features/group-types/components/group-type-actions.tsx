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
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, MoreVertical, Pen, Trash } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  useGroupTypeDeleteMutation,
  useGroupTypeUpdateMutation,
  useRateListQuery,
} from '../queries'
import { CreateGroupTypeSchema, type CreateGroupTypeSchemaType } from '../schemas'
import type { GroupTypeWithRelations } from '../types'

interface GroupTypeActionsProps {
  groupType: GroupTypeWithRelations
}

export default function GroupTypeActions({ groupType }: GroupTypeActionsProps) {
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isDeleteDisabled, setIsDeleteDisabled] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  const { data: rates = [] } = useRateListQuery()
  const { mutate: executeUpdate, isPending: isUpdatePending } = useGroupTypeUpdateMutation()
  const { mutate: executeDelete, isPending: isDeletePending } = useGroupTypeDeleteMutation()

  const isPending = isUpdatePending || isDeletePending

  const form = useForm<CreateGroupTypeSchemaType>({
    resolver: zodResolver(CreateGroupTypeSchema),
    defaultValues: {
      name: groupType.name,
      rateId: groupType.rateId,
    },
  })

  const handleEdit = (data: CreateGroupTypeSchemaType) => {
    executeUpdate(
      { id: groupType.id, ...data },
      {
        onSuccess: () => {
          setEditDialogOpen(false)
          setOpen(false)
        },
      },
    )
  }

  const handleDelete = () => {
    executeDelete(
      { id: groupType.id },
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
      name: groupType.name,
      rateId: groupType.rateId,
    })
  }, [form, editDialogOpen, groupType])

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
              Вы уверены что хотите удалить тип группы <b>{groupType.name}</b>?
              {groupType._count.groups > 0 && (
                <>
                  {' '}
                  Этот тип используется в {groupType._count.groups} группе(ах). Сначала
                  переназначьте тип в этих группах.
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
              disabled={isPending || isDeleteDisabled || groupType._count.groups > 0}
            >
              {isPending ? (
                <Loader className="animate-spin" />
              ) : isDeleteDisabled && deleteCountdown > 0 ? (
                `Удалить (${deleteCountdown}с)`
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
            <DialogTitle>Редактировать тип группы</DialogTitle>
            <DialogDescription>{groupType.name}</DialogDescription>
          </DialogHeader>

          <form id="group-type-edit-form" onSubmit={form.handleSubmit(handleEdit)}>
            <FieldGroup className="gap-2">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor="form-group-type-name">Название</FieldLabel>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                    <Input id="form-group-type-name" {...field} />
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
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Отмена</DialogClose>
            <Button type="submit" form="group-type-edit-form" disabled={isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
