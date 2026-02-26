'use client'
import { Prisma } from '@/prisma/generated/client'
import { deleteTeacherGroup, updateTeacherGroup } from '@/src/actions/groups'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Switch } from '@/src/components/ui/switch'
import { useRateListQuery } from '@/src/data/rate/rate-list-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MoreVertical, Pen, Trash } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import z from 'zod/v4'

interface UsersActionsProps {
  tg: Prisma.TeacherGroupGetPayload<{
    include: {
      teacher: true
      rate: true
    }
  }>
}

const editGroupTeacherSchema = z.object({
  rateId: z.number('Выберите ставку').int().positive('Выберите ставку'),
  isApplyToLessons: z.boolean(),
})

type EditGroupTeacherSchemaType = z.infer<typeof editGroupTeacherSchema>

export default function GroupTeacherActions({ tg }: UsersActionsProps) {
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleteFromLessons, setIsDeleteFromLessons] = useState(true)
  const [isDeleteDisabled, setIsDeleteDisabled] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  const { data: session } = useSessionQuery()
  const organizationId = session?.organizationId
  const { data: rates, isLoading: isRatesLoading } = useRateListQuery(organizationId!)

  const form = useForm<EditGroupTeacherSchemaType>({
    resolver: zodResolver(editGroupTeacherSchema),
    defaultValues: {
      rateId: tg.rateId,
      isApplyToLessons: true,
    },
  })

  const handleEdit = (data: EditGroupTeacherSchemaType) => {
    startTransition(() => {
      const { isApplyToLessons, ...payload } = data
      const ok = updateTeacherGroup(
        {
          where: {
            teacherId_groupId: {
              teacherId: tg.teacherId,
              groupId: tg.groupId,
            },
          },
          data: payload,
        },
        isApplyToLessons
      )
      toast.promise(ok, {
        loading: 'Загрузка...',
        success: 'Ставка успешно обновлена',
        error: 'Ошибка при обновлении ставки',
        finally: () => {
          setEditDialogOpen(false)
          setOpen(false)
          setIsDeleteFromLessons(false)
        },
      })
    })
  }

  const handleDelete = () => {
    startTransition(() => {
      const ok = deleteTeacherGroup(
        {
          where: {
            teacherId_groupId: {
              teacherId: tg.teacherId,
              groupId: tg.groupId,
            },
          },
        },
        isDeleteFromLessons
      )
      toast.promise(ok, {
        loading: 'Загрузка...',
        success: 'Учитель успешно удален',
        error: 'Ошибка при удалении учителя',
        finally: () => {
          setDeleteDialogOpen(false)
          setOpen(false)
          setIsDeleteFromLessons(false)
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
    form.reset({ rateId: tg.rateId, isApplyToLessons: true })
  }, [form, editDialogOpen, tg.rateId])

  const selectedRate = rates?.find((r) => r.id === form.watch('rateId'))

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
                      <Select
                        name={field.name}
                        value={field.value?.toString() || ''}
                        onValueChange={(value) => field.onChange(Number(value))}
                        itemToStringLabel={(itemValue) => {
                          const rate = rates?.find((r) => r.id === Number(itemValue))
                          return rate ? rate.name : 'Выберите ставку'
                        }}
                      >
                        <SelectTrigger id="form-rhf-select-rate" aria-invalid={fieldState.invalid}>
                          <SelectValue placeholder="Выберите ставку" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {rates?.map((rate) => (
                              <SelectItem key={rate.id} value={rate.id.toString()}>
                                {rate.name} — {rate.bid} ₽
                                {rate.bonusPerStudent > 0 && ` + ${rate.bonusPerStudent} ₽/уч.`}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
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
            <DialogClose render={<Button variant="secondary" size={'sm'} />}>Отмена</DialogClose>
            <Button type="submit" size={'sm'} form="teacher-group-edit-form" disabled={isPending}>
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
