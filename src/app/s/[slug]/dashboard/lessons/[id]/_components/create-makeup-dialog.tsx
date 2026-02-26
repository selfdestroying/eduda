'use client'

import { StudentFinancialField, StudentLessonsBalanceChangeReason } from '@/prisma/generated/enums'
import {
  AttendanceWithStudents,
  createAttendance,
  deleteAttendance,
} from '@/src/actions/attendance'
import { createMakeUp } from '@/src/actions/makeup'
import { updateStudentGroupBalance } from '@/src/actions/students'
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
import { Field, FieldContent, FieldLabel, FieldTitle } from '@/src/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Switch } from '@/src/components/ui/switch'
import { useMappedLessonListQuery } from '@/src/data/lesson/lesson-list-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { getFullName } from '@/src/lib/utils'
import { startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

type LessonOption = { label: string; value: number }

interface MakeUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attendance: AttendanceWithStudents
}

export default function MakeUpDialog({ open, onOpenChange, attendance }: MakeUpDialogProps) {
  const { data: session } = useSessionQuery()
  const organizationId = session?.organizationId

  const isReschedule = !!attendance.missedMakeup

  const [selectedDay, setSelectedDay] = useState<Date | undefined>()
  const [selectedLesson, setSelectedLesson] = useState<LessonOption | null>(null)
  const [creditBalance, setCreditBalance] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const dayKey = useMemo(() => selectedDay && startOfDay(selectedDay), [selectedDay])
  const { data: lessons = [] } = useMappedLessonListQuery(organizationId!, dayKey)

  const resetForm = useCallback(() => {
    setSelectedDay(undefined)
    setSelectedLesson(null)
    setCreditBalance(true)
  }, [])

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) resetForm()
      onOpenChange(value)
    },
    [onOpenChange, resetForm]
  )

  const handleCreate = async () => {
    if (!selectedLesson || !organizationId) return

    const newAttendance = await createAttendance({
      organizationId,
      studentId: attendance.studentId,
      lessonId: selectedLesson.value,
      comment: '',
      status: 'UNSPECIFIED',
    })

    await createMakeUp({
      organizationId,
      missedAttendanceId: attendance.id,
      makeUpAttendanceId: newAttendance.id,
    })

    if (creditBalance) {
      const originalGroupId = attendance.lesson.groupId

      await updateStudentGroupBalance(
        attendance.studentId,
        originalGroupId,
        { lessonsBalance: { increment: 1 } },
        {
          [StudentFinancialField.LESSONS_BALANCE]: {
            reason: StudentLessonsBalanceChangeReason.MAKEUP_GRANTED,
            meta: {
              missedAttendanceId: attendance.id,
              makeUpAttendanceId: newAttendance.id,
              makeUpLessonId: selectedLesson.value,
              makeUpLessonName: selectedLesson.label,
              originalGroupId,
            },
          },
        }
      )
    }
  }

  const handleReschedule = async () => {
    if (!selectedLesson || !organizationId || !attendance.missedMakeup) return

    // Удаляем старую attendance отработки — MakeUp удалится каскадно
    await deleteAttendance({
      where: { id: attendance.missedMakeup.makeUpAttendanceId },
    })

    // Создаём новую attendance + привязываем к пропуску
    const newAttendance = await createAttendance({
      organizationId,
      studentId: attendance.studentId,
      lessonId: selectedLesson.value,
      comment: '',
      status: 'UNSPECIFIED',
    })

    await createMakeUp({
      organizationId,
      missedAttendanceId: attendance.id,
      makeUpAttendanceId: newAttendance.id,
    })
  }

  const handleSubmit = async () => {
    if (!selectedLesson || !organizationId) {
      toast.error('Пожалуйста, выберите урок для отработки.')
      return
    }

    setIsSubmitting(true)

    toast.promise(isReschedule ? handleReschedule() : handleCreate(), {
      loading: 'Сохраняем...',
      success: () => {
        handleOpenChange(false)
        return isReschedule ? 'Дата отработки изменена' : 'Отработка успешно создана'
      },
      error: (e) => e.message,
      finally: () => setIsSubmitting(false),
    })
  }

  const studentName = getFullName(attendance.student.firstName, attendance.student.lastName)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isReschedule ? 'Изменить дату отработки' : 'Записать на отработку'}
          </DialogTitle>
          <DialogDescription>{studentName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" className="w-full font-normal" />}>
              <CalendarIcon />
              {selectedDay
                ? selectedDay.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
                : 'Выберите день'}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                onSelect={setSelectedDay}
                locale={ru}
                selected={selectedDay}
              />
            </PopoverContent>
          </Popover>

          <Combobox
            items={lessons}
            value={selectedLesson}
            onValueChange={setSelectedLesson}
            isItemEqualToValue={(a, b) => a?.value === b?.value}
          >
            <ComboboxInput id="form-rhf-select-lesson" placeholder="Выберите урок для отработки" />
            <ComboboxContent>
              <ComboboxEmpty>Не найдены уроки</ComboboxEmpty>
              <ComboboxList>
                {(lesson: LessonOption) => (
                  <ComboboxItem key={lesson.value} value={lesson}>
                    {lesson.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          {!isReschedule && (
            <FieldLabel htmlFor="switch-credit-balance">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Начислить +1 к балансу</FieldTitle>
                </FieldContent>
                <Switch
                  id="switch-credit-balance"
                  checked={creditBalance}
                  onCheckedChange={(val) => setCreditBalance(val as boolean)}
                />
              </Field>
            </FieldLabel>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Отмена</DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedLesson}>
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : isReschedule ? (
              'Изменить'
            ) : (
              'Создать'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
