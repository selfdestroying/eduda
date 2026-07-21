'use client'

import { NumberInput } from '@/src/components/number-input'
import { Alert, AlertDescription } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { Calendar, CalendarDayButton } from '@/src/components/ui/calendar'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Separator } from '@/src/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/src/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { Toggle } from '@/src/components/ui/toggle'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { dateToYmd, ymdToLocalDate } from '@/src/lib/timezone'
import { DaysOfWeek } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarIcon, Info, RefreshCw, Save, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useScheduleRegenerateMutation, useScheduleUpdateMutation } from '../../queries'
import type { UpdateScheduleAndLessonsSchemaType } from '../../schemas'
import { UpdateScheduleAndLessonsSchema } from '../../schemas'

const WEEKDAYS = [
  { dayOfWeek: 1, label: 'Пн', fullLabel: 'Понедельник' },
  { dayOfWeek: 2, label: 'Вт', fullLabel: 'Вторник' },
  { dayOfWeek: 3, label: 'Ср', fullLabel: 'Среда' },
  { dayOfWeek: 4, label: 'Чт', fullLabel: 'Четверг' },
  { dayOfWeek: 5, label: 'Пт', fullLabel: 'Пятница' },
  { dayOfWeek: 6, label: 'Сб', fullLabel: 'Суббота' },
  { dayOfWeek: 0, label: 'Вс', fullLabel: 'Воскресенье' },
]

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface ManageScheduleButtonProps {
  groupId: number
  schedules: Array<{ id: number; dayOfWeek: number; time: string; duration: number }>
  isOpen: boolean
  onClose: () => void
}

type ScheduleMode = 'schedule-only' | 'regenerate'

export default function ManageScheduleDialog({
  groupId,
  schedules,
  isOpen,
  onClose,
}: ManageScheduleButtonProps) {
  const { data: hasPermission } = useOrganizationPermissionQuery({
    group: ['update'],
    lesson: ['create'],
  })
  const [mode, setMode] = useState<ScheduleMode>('schedule-only')

  const scheduleUpdateMutation = useScheduleUpdateMutation()
  const scheduleRegenerateMutation = useScheduleRegenerateMutation()
  const isPending = scheduleUpdateMutation.isPending || scheduleRegenerateMutation.isPending

  const sortedInitial = [...schedules]
    .sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek))
    .map((s) => ({ dayOfWeek: s.dayOfWeek, time: s.time, duration: s.duration }))

  const form = useForm<UpdateScheduleAndLessonsSchemaType>({
    resolver: zodResolver(UpdateScheduleAndLessonsSchema),
    defaultValues: {
      groupId,
      schedule: sortedInitial,
      startDate: undefined,
      lessonCount: undefined,
    },
  })

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: 'schedule',
  })

  const watchedStartDate = form.watch('startDate')
  const watchedLessonCount = form.watch('lessonCount')

  const toggleDay = (dayOfWeek: number) => {
    const current = form.getValues('schedule') ?? []
    const exists = current.some((s) => s.dayOfWeek === dayOfWeek)

    let updated
    if (exists) {
      updated = current.filter((s) => s.dayOfWeek !== dayOfWeek)
    } else {
      updated = [...current, { dayOfWeek, time: '', duration: 60 }]
    }
    updated.sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek))
    replace(updated)
  }

  const handleSubmit = (data: UpdateScheduleAndLessonsSchemaType) => {
    if (mode === 'regenerate') {
      if (!data.startDate || !data.lessonCount) {
        if (!data.startDate) form.setError('startDate', { message: 'Выберите дату начала' })
        if (!data.lessonCount)
          form.setError('lessonCount', { message: 'Введите количество занятий' })
        return
      }
      scheduleRegenerateMutation.mutate(
        {
          groupId,
          schedule: data.schedule,
          startDate: data.startDate,
          lessonCount: data.lessonCount,
        },
        { onSuccess: () => onClose() },
      )
    } else {
      scheduleUpdateMutation.mutate(
        { groupId, schedule: data.schedule },
        { onSuccess: () => onClose() },
      )
    }
  }

  const schedulePreview = (() => {
    if (!watchedLessonCount || watchedLessonCount <= 0 || fields.length === 0) return null
    const weeksNeeded = Math.ceil(watchedLessonCount / fields.length)
    const totalDays = weeksNeeded * 7
    return { weeksNeeded, totalDays }
  })()

  if (!hasPermission?.success) return null

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Управление расписанием</SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto px-4">
          <form id="manage-schedule-form" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="space-y-5">
              {/* ── Section 1: Schedule ── */}
              <div className="space-y-3">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Расписание занятий
                </p>
                <Field>
                  <FieldLabel>Дни занятий</FieldLabel>
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map((day) => (
                      <Toggle
                        key={day.dayOfWeek}
                        pressed={fields.some((f) => f.dayOfWeek === day.dayOfWeek)}
                        onPressedChange={() => toggleDay(day.dayOfWeek)}
                        disabled={isPending}
                        variant="outline"
                      >
                        {day.label}
                      </Toggle>
                    ))}
                  </div>
                  {form.formState.errors.schedule?.root && (
                    <FieldError errors={[form.formState.errors.schedule.root]} />
                  )}
                  {fields.length > 0 && (
                    <FieldDescription>Занятий в неделю: {fields.length}</FieldDescription>
                  )}
                </Field>

                {fields.length > 0 && (
                  <div className="space-y-3">
                    <FieldLabel>Время для каждого дня</FieldLabel>
                    {fields.map((field, index) => {
                      const dayInfo = WEEKDAYS.find((d) => d.dayOfWeek === field.dayOfWeek)
                      return (
                        <div key={field.id} className="flex items-center gap-3">
                          <span className="text-muted-foreground w-28 shrink-0 text-sm">
                            {dayInfo?.fullLabel}
                          </span>
                          <Controller
                            control={form.control}
                            name={`schedule.${index}.time`}
                            disabled={isPending}
                            render={({ field: timeField, fieldState }) => (
                              <div className="flex flex-col gap-1">
                                <Input
                                  type="time"
                                  className="w-32"
                                  value={timeField.value || ''}
                                  onChange={(e) => timeField.onChange(e.target.value)}
                                  aria-invalid={fieldState.invalid}
                                  disabled={isPending}
                                />
                                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                              </div>
                            )}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* ── Mode selector ── */}
              <Tabs value={mode} onValueChange={(value) => setMode(value as ScheduleMode)}>
                <TabsList className="h-auto w-full">
                  <TabsTrigger
                    value="schedule-only"
                    disabled={isPending}
                    className="whitespace-normal"
                  >
                    <Save />
                    Сохранить
                  </TabsTrigger>
                  <TabsTrigger
                    value="regenerate"
                    disabled={isPending}
                    className="whitespace-normal"
                  >
                    <RefreshCw />
                    Перегенерировать
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="schedule-only">
                  <p className="text-muted-foreground text-xs">
                    Обновится только расписание группы. Время в существующих будущих уроках будет
                    синхронизировано.
                  </p>
                </TabsContent>
                <TabsContent value="regenerate">
                  <div className="space-y-5">
                    <p className="text-muted-foreground text-xs">
                      Расписание будет обновлено, все уроки начиная с выбранной даты - удалены и
                      созданы заново.
                    </p>

                    <div className="space-y-3">
                      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Генерация уроков
                      </p>
                      <FieldGroup className="gap-2">
                        <Controller
                          control={form.control}
                          name="startDate"
                          disabled={isPending}
                          render={({ field, fieldState }) => (
                            <Field>
                              <FieldContent>
                                <FieldLabel htmlFor="manage-startDate">Начиная с даты</FieldLabel>
                                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                              </FieldContent>
                              <Popover modal>
                                <PopoverTrigger
                                  render={<Button variant="outline" />}
                                  aria-invalid={fieldState.invalid}
                                >
                                  <CalendarIcon />
                                  {field.value
                                    ? format(ymdToLocalDate(field.value), 'dd.MM.yyyy (EEEE)', {
                                        locale: ru,
                                      })
                                    : 'Выберите дату'}
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    id="manage-startDate"
                                    mode="single"
                                    disabled={{ before: new Date() }}
                                    selected={field.value ? ymdToLocalDate(field.value) : undefined}
                                    onSelect={(d) => field.onChange(d ? dateToYmd(d) : undefined)}
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
                              {watchedStartDate && (
                                <FieldDescription>
                                  День недели:{' '}
                                  {DaysOfWeek.full[ymdToLocalDate(watchedStartDate).getDay()]}
                                </FieldDescription>
                              )}
                            </Field>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name="lessonCount"
                          disabled={isPending}
                          render={({ field, fieldState }) => (
                            <Field>
                              <FieldContent>
                                <FieldLabel htmlFor="manage-lessonCount">
                                  Количество занятий
                                </FieldLabel>
                                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                              </FieldContent>
                              <NumberInput
                                id="manage-lessonCount"
                                min={1}
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                aria-invalid={fieldState.invalid}
                                disabled={isPending}
                              />
                            </Field>
                          )}
                        />
                      </FieldGroup>
                    </div>

                    {/* ── Preview ── */}
                    {schedulePreview && watchedStartDate && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-muted-foreground text-xs">
                          <span className="font-medium">Предварительный расчёт:</span>{' '}
                          {watchedLessonCount} уроков за ~{schedulePreview.weeksNeeded} нед. (
                          {fields
                            .map((f) => WEEKDAYS.find((d) => d.dayOfWeek === f.dayOfWeek)?.label)
                            .join(', ')}
                          )
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* ── Warning ── */}
                    <Alert variant="destructive">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertDescription>
                        Расписание будет обновлено, а все уроки начиная с выбранной даты - удалены и
                        созданы заново. Данные посещаемости удалённых уроков будут потеряны.
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </form>
        </div>
        <SheetFooter>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            form="manage-schedule-form"
            type="submit"
            disabled={isPending}
            variant={mode === 'regenerate' ? 'destructive' : 'default'}
          >
            {isPending
              ? 'Сохранение...'
              : mode === 'schedule-only'
                ? 'Сохранить расписание'
                : 'Сохранить и перегенерировать'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
