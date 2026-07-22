'use client'

import type { Attendance } from '@/prisma/generated/client'
import { Button } from '@/src/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Textarea } from '@/src/components/ui/textarea'
import { ArrowRight, Loader, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useUpdateAttendanceCommentMutation } from '../queries'

export type AttendanceForCommentPopover = Pick<Attendance, 'studentId' | 'lessonId' | 'comment'>

interface AttendanceCommentPopoverProps {
  attendance: AttendanceForCommentPopover
  /** Контейнер для портала popover'а — нужен внутри модальных drawer'ов (vaul блокирует клики вне контента). */
  popoverContainer?: HTMLElement | null
}

/** Кнопка-иконка с popover'ом для редактирования комментария к посещению ученика. */
export function AttendanceCommentPopover({
  attendance,
  popoverContainer,
}: AttendanceCommentPopoverProps) {
  const { mutate: updateComment, isPending } = useUpdateAttendanceCommentMutation(
    attendance.lessonId,
  )
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState(attendance.comment ?? '')

  // Синхронизируем черновик с сохранённым комментарием при каждом открытии.
  useEffect(() => {
    if (open) setComment(attendance.comment ?? '')
  }, [open, attendance.comment])

  const handleSubmit = () => {
    updateComment(
      { studentId: attendance.studentId, lessonId: attendance.lessonId, comment: comment.trim() },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success('Комментарий сохранён')
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Не удалось сохранить комментарий'),
      },
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Комментарий" />}>
        <MessageCircle />
      </PopoverTrigger>
      <PopoverContent container={popoverContainer}>
        <div className="grid gap-2">
          <div>Комментарий</div>
          <Textarea
            placeholder="Напишите комментарий…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isPending}
          />
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <Loader className="animate-spin" />
            ) : (
              <>
                Сохранить <ArrowRight />
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
