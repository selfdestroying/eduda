'use client'

import { formatDateOnly } from '@/src/lib/timezone'
import { cn, getGroupName } from '@/src/lib/utils'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Loader, MapPin, Users } from 'lucide-react'
import { useState } from 'react'
import { useCreatePublicMakeupMutation, useMakeupOptionsQuery } from '../queries'

interface MakeupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  studentId: number
  /** Запись о пропуске, за которую назначается отработка. */
  attendanceId: number
  /** Дата пропущенного занятия `YYYY-MM-DD` — показываем, за что отработка. */
  missedDate: string
}

export default function MakeupDialog({
  open,
  onOpenChange,
  token,
  studentId,
  attendanceId,
  missedDate,
}: MakeupDialogProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const {
    data: options,
    isPending,
    isError,
  } = useMakeupOptionsQuery(token, studentId, attendanceId)
  const createMakeup = useCreatePublicMakeupMutation()

  const handleOpenChange = (value: boolean) => {
    if (!value) setSelectedId(null)
    onOpenChange(value)
  }

  const handleSubmit = () => {
    if (selectedId == null) return
    createMakeup.mutate(
      { token, studentId, attendanceId, targetLessonId: selectedId },
      { onSuccess: () => handleOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Записаться на отработку</DialogTitle>
          <DialogDescription>
            Взамен занятия{' '}
            {formatDateOnly(missedDate, { day: 'numeric', month: 'long', year: 'numeric' })}.
            Показаны занятия того же курса в той же локации, где есть свободные места.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <p className="text-muted-foreground text-sm">
            Не удалось загрузить занятия. Попробуйте обновить страницу.
          </p>
        ) : options.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Подходящих занятий не нашлось. Свяжитесь со школой — вам подберут дату вручную.
          </p>
        ) : (
          <div className="thin-scrollbar max-h-80 space-y-1.5 overflow-y-auto">
            {options.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => setSelectedId(lesson.id)}
                aria-pressed={selectedId === lesson.id}
                className={cn(
                  'w-full cursor-pointer rounded-lg border p-2.5 text-left transition-colors',
                  selectedId === lesson.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {formatDateOnly(lesson.date, {
                      day: 'numeric',
                      month: 'long',
                      weekday: 'short',
                    })}
                    {lesson.time ? `, ${lesson.time}` : ''}
                  </span>
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
                    <Users className="size-3" />
                    {lesson.freeSeats}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">{getGroupName(lesson.group)}</p>
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {lesson.group.location.name}
                  </span>
                  {lesson.teachers.length > 0 && <span>{lesson.teachers.join(', ')}</span>}
                </p>
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Отмена</DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={selectedId == null || createMakeup.isPending}
            className="gap-2"
          >
            {createMakeup.isPending && <Loader className="animate-spin" />}
            Записаться
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
