'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog'
import { Button } from '@/src/components/ui/button'
import { useCancelLessonMutation, useRestoreLessonMutation } from '../queries'
import { useLessonDetail } from './lesson-detail-context'

interface CancelLessonDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function CancelLessonDialog({ isOpen, onClose }: CancelLessonDialogProps) {
  const { lessonId } = useLessonDetail()
  const { mutate, isPending } = useCancelLessonMutation(lessonId)

  const handleCancel = () => {
    mutate(undefined, { onSettled: () => onClose() })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Отмена урока</AlertDialogTitle>
          <AlertDialogDescription>
            После отмены урока редактирование посещаемости будет заблокировано. Текущая посещаемость
            сохранится.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Назад</AlertDialogCancel>
          <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
            Отменить урок
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface RestoreLessonDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function RestoreLessonDialog({ isOpen, onClose }: RestoreLessonDialogProps) {
  const { lessonId } = useLessonDetail()
  const { mutate, isPending } = useRestoreLessonMutation(lessonId)

  const handleRestore = () => {
    mutate(undefined, { onSettled: () => onClose() })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Восстановление урока</AlertDialogTitle>
          <AlertDialogDescription>
            Урок будет возвращён в активный статус. Посещаемость станет доступна для редактирования.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
          <Button onClick={handleRestore} disabled={isPending}>
            Восстановить
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
