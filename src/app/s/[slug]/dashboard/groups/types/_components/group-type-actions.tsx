'use client'

import { Prisma, Rate } from '@/prisma/generated/client'
import { deleteGroupType, updateGroupType } from '@/src/actions/group-types'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { GroupTypeSchema, GroupTypeSchemaType } from '@/src/schemas/group-type'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MoreVertical, Pen, Trash } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

type GroupTypeWithRelations = Prisma.GroupTypeGetPayload<{
  include: {
    rate: true
    _count: { select: { groups: true } }
  }
}>

interface GroupTypeActionsProps {
  groupType: GroupTypeWithRelations
  rates: Rate[]
}

export default function GroupTypeActions({ groupType, rates }: GroupTypeActionsProps) {
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleteDisabled, setIsDeleteDisabled] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  const form = useForm<GroupTypeSchemaType>({
    resolver: zodResolver(GroupTypeSchema),
    defaultValues: {
      name: groupType.name,
      rateId: groupType.rateId,
    },
  })

  const handleEdit = (data: GroupTypeSchemaType) => {
    startTransition(() => {
      const ok = updateGroupType({
        where: { id: groupType.id },
        data,
      })
      toast.promise(ok, {
        loading: 'Обновление типа группы...',
        success: 'Тип группы успешно обновлен',
        error: 'Ошибка при обновлении типа группы',
        finally: () => {
          setEditDialogOpen(false)
          setOpen(false)
        },
      })
    })
  }

  const handleDelete = () => {
    startTransition(() => {
      const ok = deleteGroupType({ where: { id: groupType.id } })
      toast.promise(ok, {
        loading: 'Удаление типа группы...',
        success: 'Тип группы удален',
        error:
          groupType._count.groups > 0
            ? 'Невозможно удалить тип группы, который используется в группах'
            : 'Ошибка при удалении типа группы',
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
            <Button variant="secondary" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || isDeleteDisabled || groupType._count.groups > 0}
              size="sm"
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
                      <FieldLabel htmlFor="form-group-type-rate">Ставка</FieldLabel>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                    <Select
                      name={field.name}
                      value={field.value?.toString() || ''}
                      onValueChange={(value) => field.onChange(Number(value))}
                      itemToStringLabel={(itemValue) =>
                        rates.find((r) => r.id === Number(itemValue))?.name || ''
                      }
                    >
                      <SelectTrigger id="form-group-type-rate" aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder="Выберите ставку" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {rates.map((rate) => (
                            <SelectItem key={rate.id} value={rate.id.toString()}>
                              {rate.name} ({rate.bid.toLocaleString()} ₽
                              {rate.bonusPerStudent > 0 ? ` + ${rate.bonusPerStudent} ₽/уч.` : ''})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <DialogFooter>
            <DialogClose render={<Button variant="secondary" size="sm" />}>Отмена</DialogClose>
            <Button type="submit" size="sm" form="group-type-edit-form" disabled={isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
