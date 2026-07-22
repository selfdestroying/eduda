'use client'

import { NumberInput } from '@/src/components/number-input'
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
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, MoreVertical, Pen, Trash } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'
import { useDeleteTeacherLessonMutation, useUpdateTeacherLessonMutation } from '../queries'
import type { TeacherLessonRow } from '../types'
import { useLessonDetail } from './lesson-detail-context'

const EditTeacherLessonFormSchema = z.object({
  bid: z
    .number('Не указана ставка')
    .int('Ставка должна быть числом')
    .gte(0, 'Ставка должна быть >= 0'),
  bonusPerStudent: z
    .number('Не указан бонус')
    .int('Бонус должен быть целым числом')
    .gte(0, 'Бонус должен быть >= 0'),
})

type EditTeacherLessonFormValues = z.infer<typeof EditTeacherLessonFormSchema>

interface LessonTeacherActionsProps {
  tl: TeacherLessonRow
}

export default function LessonTeacherActions({ tl }: LessonTeacherActionsProps) {
  const { lessonId } = useLessonDetail()
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isDeleteDisabled, setIsDeleteDisabled] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  const updateMutation = useUpdateTeacherLessonMutation(lessonId)
  const deleteMutation = useDeleteTeacherLessonMutation(lessonId)

  const form = useForm<EditTeacherLessonFormValues>({
    resolver: zodResolver(EditTeacherLessonFormSchema),
    defaultValues: {
      bid: tl.bid,
      bonusPerStudent: tl.bonusPerStudent,
    },
  })

  const handleEdit = (data: EditTeacherLessonFormValues) => {
    updateMutation.mutate(
      {
        teacherId: tl.teacherId,
        lessonId: tl.lessonId,
        ...data,
      },
      {
        onSettled: () => {
          setEditDialogOpen(false)
          setOpen(false)
        },
      },
    )
  }

  const handleDelete = () => {
    deleteMutation.mutate(
      { teacherId: tl.teacherId, lessonId: tl.lessonId },
      {
        onSettled: () => {
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
    form.reset()
  }, [form, editDialogOpen])

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
              Вы уверены что хотите удалить <b>{tl.teacher.name}</b> из списка преподавателей?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button variant={'secondary'} onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending || isDeleteDisabled}
            >
              {deleteMutation.isPending ? (
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
            <DialogTitle>Редактировать</DialogTitle>
            <DialogDescription>{tl.teacher.name}</DialogDescription>
          </DialogHeader>

          <form id="teacher-group-edit-form" onSubmit={form.handleSubmit(handleEdit)}>
            <FieldGroup className="gap-2">
              <Controller
                name="bid"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor="form-rhf-input-bid">Ставка</FieldLabel>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                    <NumberInput id="form-rhf-input-bid" {...field} onChange={field.onChange} />
                  </Field>
                )}
              />
              <Controller
                name="bonusPerStudent"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor="form-rhf-input-bonus">Бонус за ученика</FieldLabel>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                    <NumberInput id="form-rhf-input-bonus" {...field} onChange={field.onChange} />
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              type="submit"
              form="teacher-group-edit-form"
              disabled={updateMutation.isPending}
            >
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
