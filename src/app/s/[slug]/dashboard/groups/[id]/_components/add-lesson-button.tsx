'use client'
import { Prisma } from '@/prisma/generated/client'
import { createLesson } from '@/src/actions/lessons'
import { normalizeDateOnly } from '@/src/lib/timezone'
import { Button } from '@/src/components/ui/button'
import { Calendar } from '@/src/components/ui/calendar'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/data/user/session-query'
import { timeSlots } from '@/src/shared/time-slots'
import { zodResolver } from '@hookform/resolvers/zod'
import { ru } from 'date-fns/locale'
import { CalendarIcon, Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod/v4'

interface AddLessonButtonProps {
  group: Prisma.GroupGetPayload<{
    include: { students: true; teachers: { include: { rate: true } } }
  }>
}

const AddLessonSchema = z.object({
  date: z.date('Выберите дату урока').transform(normalizeDateOnly),
  time: z.string('Введите время урока'),
})

type AddLessonSchemaType = z.infer<typeof AddLessonSchema>

export default function AddLessonButton({ group }: AddLessonButtonProps) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId ?? undefined
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const form = useForm({
    resolver: zodResolver(AddLessonSchema),
    defaultValues: {
      date: undefined,
      time: undefined,
    },
  })

  const handleSubmit = (values: AddLessonSchemaType) => {
    startTransition(() => {
      const { ...payload } = values
      const attendances = group.students.map((student) => ({
        organizationId: organizationId!,
        studentId: student.studentId,
        status: 'UNSPECIFIED' as const,
        comment: '',
      }))
      const teacherLessons = group.teachers.map((teacherGroup) => ({
        organizationId: organizationId!,
        teacherId: teacherGroup.teacherId,
        bid: teacherGroup.rate.bid,
        bonusPerStudent: teacherGroup.rate.bonusPerStudent,
      }))
      const ok = createLesson({
        data: {
          ...payload,
          organizationId: organizationId!,
          groupId: group.id,
          attendance: {
            createMany: {
              data: attendances,
            },
          },
          teachers: {
            createMany: { data: teacherLessons },
          },
        },
      })
      toast.promise(ok, {
        loading: 'Добавление занятия...',
        success: 'Занятие успешно добавлено!',
        error: 'Ошибка при добавлении занятия.',
        finally: () => {
          setDialogOpen(false)
          form.reset()
        },
      })
    })
  }

  if (isSessionLoading) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger
        render={
          <Button size={'icon'}>
            <Plus />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить занятие</DialogTitle>
          <DialogDescription>Введите дату и время для нового занятия</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} id="add-lesson-form">
          <FieldGroup>
            <Controller
              control={form.control}
              name="date"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="lesson-date-field">Дата урока</FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className="w-full font-normal"
                          aria-invalid={fieldState.invalid}
                        />
                      }
                    >
                      <CalendarIcon />
                      {field.value
                        ? field.value.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
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
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant={'outline'}>Отмена</Button>} />
          <Button type="submit" form="add-lesson-form" disabled={isPending}>
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
