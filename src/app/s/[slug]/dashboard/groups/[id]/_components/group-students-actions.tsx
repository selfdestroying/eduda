'use client'
import { Prisma } from '@/prisma/generated/client'
import { createDismissed } from '@/src/actions/dismissed'
import { deleteStudentGroup, getGroups, updateStudentGroup } from '@/src/actions/groups'
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
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/src/components/ui/combobox'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/src/components/ui/item'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/data/user/session-query'
import { getFullName, getGroupName } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  CalendarIcon,
  DoorOpen,
  GitCompare,
  Loader2,
  MoreVertical,
  Trash,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import z from 'zod/v4'

interface UsersActionsProps {
  sg: Prisma.StudentGroupGetPayload<{ include: { student: true } }>
}

const dismissStudentSchema = z.object({
  date: z.date('Укажите дату'),
  comment: z.string('Укажите комментарий'),
})

const transferStudentSchema = z.object({
  group: z.object(
    {
      label: z.string(),
      value: z.number(),
    },
    'Выберите группу'
  ),
})

type DismissStudentSchemaType = z.infer<typeof dismissStudentSchema>
type TransferStudentSchemaType = z.infer<typeof transferStudentSchema>

export default function GroupStudentActions({ sg }: UsersActionsProps) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleteDisabled, setIsDeleteDisabled] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(0)
  const [groups, setGroups] = useState<{ label: string; value: number; disabled?: boolean }[]>([])

  useEffect(() => {
    async function fetchGroups() {
      const data = await getGroups({
        where: {
          organizationId: session?.organizationId ?? undefined,
          NOT: {
            id: sg.groupId,
          },
        },
        include: {
          location: true,
          course: true,
          schedules: true,
          students: true,
          teachers: {
            include: {
              teacher: true,
            },
          },
        },
      })
      setGroups(
        data.map((group) => {
          const name = getGroupName(group)
          const location = group.location?.name
          const teachers = group.teachers.map((t) => t.teacher.name).join(', ')
          const parts = [name, location, teachers].filter(Boolean)
          const isFull = group.students.length >= group.maxStudents
          return {
            label: `${parts.join(' · ')} (${group.students.length}/${group.maxStudents})`,
            value: group.id,
            disabled: isFull,
          }
        })
      )
    }
    fetchGroups()
  }, [sg.groupId, isSessionLoading, session?.organizationId])

  const dismissForm = useForm<DismissStudentSchemaType>({
    resolver: zodResolver(dismissStudentSchema),
    defaultValues: {
      date: undefined,
      comment: undefined,
    },
  })
  const transferForm = useForm<TransferStudentSchemaType>({
    resolver: zodResolver(transferStudentSchema),
    defaultValues: {
      group: undefined,
    },
  })

  const handleDismiss = (values: DismissStudentSchemaType) => {
    startTransition(() => {
      const ok = deleteStudentGroup({
        where: {
          studentId_groupId: {
            studentId: sg.student.id,
            groupId: sg.groupId,
          },
        },
      }).then(() =>
        createDismissed({
          data: {
            ...values,
            studentId: sg.student.id,
            groupId: sg.groupId,
            organizationId: sg.organizationId,
          },
        })
      )
      toast.promise(ok, {
        loading: 'Загрузка...',
        success: 'Студент успешно переведен в отток',
        error: 'Ошибка при переводе студента в отток',
        finally: () => {
          setDismissDialogOpen(false)
          setOpen(false)
        },
      })
    })
  }

  const handleDelete = () => {
    startTransition(() => {
      const ok = deleteStudentGroup({
        where: {
          studentId_groupId: {
            studentId: sg.student.id,
            groupId: sg.groupId,
          },
        },
      })
      toast.promise(ok, {
        loading: 'Загрузка...',
        success: 'Учитель успешно удален',
        error: 'Ошибка при удалении учителя',
        finally: () => {
          setDeleteDialogOpen(false)
          setOpen(false)
        },
      })
    })
  }

  const handleTransfer = (values: TransferStudentSchemaType) => {
    startTransition(() => {
      const ok = updateStudentGroup(
        {
          where: {
            studentId_groupId: {
              studentId: sg.student.id,
              groupId: sg.groupId,
            },
          },
          data: {
            groupId: values.group.value,
          },
        },
        true
      )
      toast.promise(ok, {
        loading: 'Загрузка...',
        success: 'Студент успешно переведен в другую группу',
        error: 'Ошибка при переводе студента в другую группу',
        finally: () => {
          setTransferDialogOpen(false)
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
    dismissForm.reset()
  }, [dismissForm, dismissDialogOpen])

  if (isSessionLoading) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" />}>
          <MoreVertical />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-max">
          <DropdownMenuItem
            onClick={() => {
              setDismissDialogOpen(true)
              setOpen(false)
            }}
          >
            <DoorOpen />
            Перевести в оттток
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setTransferDialogOpen(true)
              setOpen(false)
            }}
          >
            <GitCompare />
            Перевести в группу
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
              Вы уверены что хотите удалить{' '}
              <b>{getFullName(sg.student.firstName, sg.student.lastName)}</b> из списка учеников?
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

      <Dialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Перевести в отток</DialogTitle>
            <DialogDescription>
              Укажите дату отчисления и комментарий (необязательно)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={dismissForm.handleSubmit(handleDismiss)} id="dismiss-form">
            <FieldGroup>
              <Controller
                control={dismissForm.control}
                name="date"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Дата отчисления</FieldLabel>
                    <Popover modal>
                      <PopoverTrigger render={<Button variant="outline" />}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, 'dd.MM.yyyy') : 'Выбрать дату'}
                      </PopoverTrigger>
                      <PopoverContent>
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
                      </PopoverContent>
                    </Popover>
                  </Field>
                )}
              />

              <Controller
                control={dismissForm.control}
                name="comment"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Комментарий</FieldLabel>
                    <Input type="text" {...field} value={field.value ?? ''} />
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <DialogFooter>
            <DialogClose render={<Button variant="secondary" size={'sm'} />}>Cancel</DialogClose>
            <Button type="submit" size={'sm'} form="dismiss-form" disabled={isPending}>
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Перевести</DialogTitle>
            <DialogDescription>Выберите группу для перевода студента</DialogDescription>
          </DialogHeader>

          <form onSubmit={transferForm.handleSubmit(handleTransfer)} id="transfer-form">
            <FieldGroup>
              <Controller
                control={transferForm.control}
                name="group"
                render={({ field, fieldState }) => (
                  <Field>
                    <Combobox
                      items={groups}
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      isItemEqualToValue={(itemValue, selectedValue) =>
                        itemValue.value === selectedValue.value
                      }
                    >
                      <ComboboxInput id="form-rhf-select-group" aria-invalid={fieldState.invalid} />
                      <ComboboxContent>
                        <ComboboxEmpty>Нет доступных студентов</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem key={item.value} value={item} disabled={item.disabled}>
                              {item.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <Item variant="outline" size="sm">
            <ItemMedia variant="icon">
              <TriangleAlert />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Внимание</ItemTitle>
              <ItemDescription>
                Неотмеченные записи посещаемости в текущей группе будут удалены.
              </ItemDescription>
            </ItemContent>
          </Item>

          <DialogFooter>
            <DialogClose render={<Button variant="secondary" size={'sm'} />}>Cancel</DialogClose>
            <Button type="submit" size={'sm'} form="transfer-form" disabled={isPending}>
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
