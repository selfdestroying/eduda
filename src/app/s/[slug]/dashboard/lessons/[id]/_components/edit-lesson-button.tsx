'use client'

import { Lesson } from '@/prisma/generated/client'
import { updateLesson } from '@/src/actions/lessons'
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
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { EditLessonSchema, EditLessonSchemaType } from '@/src/schemas/lesson'
import { timeSlots } from '@/src/shared/time-slots'
import { zodResolver } from '@hookform/resolvers/zod'
import { ru } from 'date-fns/locale'
import { Pen } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface EditLessonButtonProps {
  lesson: Lesson
}

const statusItems = [
  { label: 'Активен', value: 'ACTIVE' },
  { label: 'Отменен', value: 'CANCELLED' },
]

export default function EditLessonButton({ lesson }: EditLessonButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const form = useForm<EditLessonSchemaType>({
    resolver: zodResolver(EditLessonSchema),
    defaultValues: {
      date: lesson.date,
      time: lesson.time || undefined,
      status: lesson.status,
    },
  })

  const handleSubmit = (values: EditLessonSchemaType) => {
    startTransition(() => {
      const ok = updateLesson({
        where: { id: lesson.id },
        data: values,
      })
      toast.promise(ok, {
        loading: 'Сохранение изменений...',
        success: 'Изменения успешно сохранены!',
        error: 'Ошибка при сохранении изменений.',
        finally: () => {
          setDialogOpen(false)
        },
      })
    })
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger
        render={
          <Button size={'icon'}>
            <Pen />
          </Button>
        }
      />

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
                  <Select
                    {...field}
                    items={timeSlots}
                    value={field.value || ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="lesson-time-field" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Выберите время" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="status"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="lesson-status-field">Статус урока</FieldLabel>
                  <Select
                    {...field}
                    items={statusItems}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="lesson-status-field" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Выберите статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="ACTIVE">Активен</SelectItem>
                        <SelectItem value="CANCELLED">Отменен</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
