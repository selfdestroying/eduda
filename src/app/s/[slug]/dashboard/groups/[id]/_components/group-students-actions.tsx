'use client'
import { Prisma } from '@/prisma/generated/client'
import { createDismissed } from '@/src/actions/dismissed'
import { deleteStudentGroup, getGroups, updateStudentGroup } from '@/src/actions/groups'
import { Alert, AlertDescription } from '@/src/components/ui/alert'
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
import { Calendar } from '@/src/components/ui/calendar'
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
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/data/user/session-query'
import { cn, getGroupName } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
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
  const [groups, setGroups] = useState<
    {
      label: string
      value: number
      disabled?: boolean
      itemType?: 'group'
      teachers?: string
      location?: string
      students?: number
      maxStudents?: number
    }[]
  >([])

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
          return {
            label: `${getGroupName(group)}`,
            itemType: 'group' as const,
            teachers: `${group.teachers.map((t) => t.teacher.name).join(', ')}`,
            location: group.location.name,
            students: group.students.length,
            maxStudents: group.maxStudents,
            value: group.id,
            disabled: group.students.length >= group.maxStudents,
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
            <AlertDialogMedia>
              <TriangleAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
            <AlertDialogDescription>
              Неотмеченные записи посещаемости в текущей группе будут удалены.
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
                `${deleteCountdown} с`
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
                    <Popover>
                      <PopoverTrigger
                        render={<Button variant="outline" className="w-full font-normal" />}
                      >
                        <CalendarIcon />
                        {field.value
                          ? field.value.toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                            })
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

          <Alert>
            <TriangleAlert />
            <AlertDescription>
              Неотмеченные записи посещаемости в текущей группе будут удалены.
            </AlertDescription>
          </Alert>

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
                      <ComboboxInput
                        id="form-rhf-select-group"
                        placeholder="Выберите группу"
                        aria-invalid={fieldState.invalid}
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>Нет доступных групп</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem key={item.value} value={item} disabled={item.disabled}>
                              <Item size="xs" className="p-0">
                                <ItemContent>
                                  <ItemTitle className="whitespace-nowrap">{item.label}</ItemTitle>
                                  <ItemDescription>
                                    {item.teachers} | {item.location} |{' '}
                                    <span
                                      className={cn(
                                        'tabular-nums',
                                        item.disabled && 'text-destructive'
                                      )}
                                    >
                                      {item.students}/{item.maxStudents}
                                    </span>
                                  </ItemDescription>
                                </ItemContent>
                              </Item>
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

          <Alert>
            <TriangleAlert />
            <AlertDescription>
              Неотмеченные записи посещаемости в текущей группе будут удалены.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <DialogClose render={<Button variant="secondary" size={'sm'} />}>Отмена</DialogClose>
            <Button type="submit" size={'sm'} form="transfer-form" disabled={isPending}>
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
