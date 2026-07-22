'use client'

import { Lesson } from '@/prisma/generated/client'
import { Button } from '@/src/components/ui/button'
import { Calendar, CalendarDayButton } from '@/src/components/ui/calendar'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { dateToYmd, ymdToLocalDate } from '@/src/lib/timezone'
import { zodResolver } from '@hookform/resolvers/zod'
import { ru } from 'date-fns/locale'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'
import { useUpdateLessonMutation } from '../queries'

const EditLessonFormSchema = z.object({
  date: z.date(),
  time: z.string('Выберите время урока'),
})

type EditLessonFormValues = z.infer<typeof EditLessonFormSchema>

interface EditLessonDialogProps {
  lesson: Lesson
  isOpen: boolean
  onClose: () => void
}

export default function EditLessonDialog({ lesson, isOpen, onClose }: EditLessonDialogProps) {
  const { mutate, isPending } = useUpdateLessonMutation(lesson.id)
  const form = useForm<EditLessonFormValues>({
    resolver: zodResolver(EditLessonFormSchema),
    defaultValues: {
      date: ymdToLocalDate(lesson.date),
      time: lesson.time || undefined,
    },
  })

  const handleSubmit = (values: EditLessonFormValues) => {
    mutate({ date: dateToYmd(values.date), time: values.time }, { onSettled: () => onClose() })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать урок</DialogTitle>
          <DialogDescription>Здесь вы можете изменить информацию об уроке.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} id="edit-lesson-form">
          <FieldGroup>
            <Controller
              control={form.control}
              name="date"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="lesson-date-field">Дата урока</FieldLabel>
                  <Calendar
                    id="lesson-date-field"
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
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="time"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="lesson-time-field">Время урока</FieldLabel>
                  <Input
                    id="lesson-time-field"
                    type="time"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant={'outline'}>Отмена</Button>} />
          <Button type="submit" form="edit-lesson-form" disabled={isPending}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
