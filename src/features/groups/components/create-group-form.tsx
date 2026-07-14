'use client'

import { Controller, useFieldArray, useForm } from 'react-hook-form'

import { CustomCombobox } from '@/src/components/custom-combobox'
import { NumberInput } from '@/src/components/number-input'
import { memberRoleLabels } from '@/src/components/sidebar/nav-user'
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
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Separator } from '@/src/components/ui/separator'
import { Toggle } from '@/src/components/ui/toggle'
import { useCourseListQuery } from '@/src/features/courses/queries'
import { useGroupTypeListQuery } from '@/src/features/group-types/queries'
import { useLocationListQuery } from '@/src/features/locations/queries'
import { useMemberListQuery } from '@/src/features/organization/members/queries'
import { useRateListQuery } from '@/src/features/organization/rates/queries'
import { dateToYmd, ymdToLocalDate } from '@/src/lib/timezone'
import { DaysOfWeek } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'

import { OrganizationRole } from '@/src/lib/auth/server'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarIcon, Loader } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useGroupCreateMutation } from '../queries'
import { CreateGroupSchema, type CreateGroupSchemaType } from '../schemas'

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

function computeLastLessonDate(
  startDate: string | undefined,
  scheduleDays: number[],
  lessonCount: number | undefined,
): Date | null {
  if (!startDate || !scheduleDays.length || !lessonCount || lessonCount <= 0) return null

  const daysSet = new Set(scheduleDays)
  const currentDate = ymdToLocalDate(startDate)
  let count = 0
  let lastDate = new Date(currentDate)
  const maxIterations = lessonCount * 7 + 7

  for (let i = 0; i < maxIterations && count < lessonCount; i++) {
    if (daysSet.has(currentDate.getDay())) {
      count++
      lastDate = new Date(currentDate)
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return count >= lessonCount ? lastDate : null
}

export default function CreateGroupForm() {
  const router = useRouter()
  const { data: courses, isLoading: isCoursesLoading } = useCourseListQuery()
  const { data: locations, isLoading: isLocationsLoading } = useLocationListQuery()
  const { data: members, isLoading: isMembersLoading } = useMemberListQuery()
  const { data: rates, isLoading: isRatesLoading } = useRateListQuery()

  const { data: groupTypes, isLoading: isGroupTypesLoading } = useGroupTypeListQuery()
  const createMutation = useGroupCreateMutation()

  const form = useForm<CreateGroupSchemaType>({
    resolver: zodResolver(CreateGroupSchema),
    defaultValues: {
      name: '',
      url: undefined,
      groupTypeId: undefined,
      startDate: undefined,
      courseId: undefined,
      locationId: undefined,
      teacherId: undefined,
      rateId: undefined,
      lessonCount: undefined,
      maxStudents: 10,
      schedule: [],
    },
  })

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: 'schedule',
  })

  const watchedStartDate = form.watch('startDate')
  const watchedGroupTypeId = form.watch('groupTypeId')
  const watchedLessonCount = form.watch('lessonCount')

  useEffect(() => {
    if (!watchedGroupTypeId || !groupTypes) return
    const selectedType = groupTypes.find((gt) => gt.id === watchedGroupTypeId)
    if (!selectedType) return

    const rate = selectedType.rate
    form.setValue('rateId', rate.id)
  }, [watchedGroupTypeId, groupTypes, form])

  const scheduleDays = fields.map((f) => f.dayOfWeek)
  const lastLessonDate = computeLastLessonDate(watchedStartDate, scheduleDays, watchedLessonCount)

  const toggleDay = (dayOfWeek: number) => {
    const current = form.getValues('schedule') ?? []
    const exists = current.some((s) => s.dayOfWeek === dayOfWeek)

    let updated
    if (exists) {
      updated = current.filter((s) => s.dayOfWeek !== dayOfWeek)
    } else {
      updated = [...current, { dayOfWeek, time: '' }]
    }
    updated.sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek))
    replace(updated)
  }

  const onSubmit = (values: CreateGroupSchemaType) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        form.reset()
        router.push('/groups')
      },
    })
  }

  const isPending = createMutation.isPending

  if (
    isMembersLoading ||
    isLocationsLoading ||
    isCoursesLoading ||
    isRatesLoading ||
    isGroupTypesLoading
  ) {
    return null
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {/* Секция: Основные параметры */}
      <section className="space-y-1">
        <h3 className="text-sm font-medium">Основные параметры</h3>
        <p className="text-muted-foreground text-xs">Курс, локация, преподаватель и тип группы</p>
      </section>
      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Controller
            control={form.control}
            name="courseId"
            disabled={isPending}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="form-rhf-select-course">Курс</FieldLabel>
                <CustomCombobox
                  id="form-rhf-select-course"
                  items={courses || []}
                  getKey={(c) => c.id}
                  getLabel={(c) => c.name}
                  value={courses?.find((c) => c.id === field.value) || null}
                  onValueChange={(c) => c && field.onChange(c.id)}
                  placeholder="Выберите курс"
                  emptyText="Не найдено курсов"
                  renderItem={(c) => (
                    <Item size="xs" className="p-0">
                      <ItemContent>
                        <ItemTitle className="whitespace-nowrap">{c.name}</ItemTitle>
                      </ItemContent>
                    </Item>
                  )}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="locationId"
            disabled={isPending}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="form-rhf-select-location">Локация</FieldLabel>
                <CustomCombobox
                  id="form-rhf-select-location"
                  items={locations || []}
                  value={locations?.find((l) => l.id === field.value) || null}
                  getKey={(l) => l.id}
                  getLabel={(l) => l.name}
                  onValueChange={(l) => l && field.onChange(l.id)}
                  placeholder="Выберите локацию"
                  emptyText="Не найдено локаций"
                  renderItem={(l) => (
                    <Item size="xs" className="p-0">
                      <ItemContent>
                        <ItemTitle className="whitespace-nowrap">{l.name}</ItemTitle>
                      </ItemContent>
                    </Item>
                  )}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <Controller
          control={form.control}
          name="teacherId"
          disabled={isPending}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="teacherId-field">Преподаватель</FieldLabel>
              <CustomCombobox
                id="form-rhf-select-teacher"
                items={members || []}
                getKey={(m) => m.user.id}
                getLabel={(m) => m.user.name}
                value={members?.find((m) => m.user.id === field.value) || null}
                onValueChange={(m) => m && field.onChange(m.user.id)}
                placeholder="Выберите преподавателя"
                emptyText="Не найдены преподаватели"
                renderItem={(m) => (
                  <Item size="xs" className="p-0">
                    <ItemContent>
                      <ItemTitle className="whitespace-nowrap">{m.user.name}</ItemTitle>
                      <ItemDescription>
                        <span>{memberRoleLabels[m.role as OrganizationRole]}</span>
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                )}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="groupTypeId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-select-groupType">Тип группы</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <CustomCombobox
                id="form-rhf-select-groupType"
                items={groupTypes || []}
                value={groupTypes?.find((gt) => gt.id === field.value) || null}
                getKey={(gt) => gt.id}
                getLabel={(gt) => gt.name}
                onValueChange={(gt) => gt && field.onChange(gt.id)}
                placeholder="Выберите тип группы"
                emptyText="Не найдено типов групп"
                renderItem={(gt) => (
                  <Item size="xs" className="p-0">
                    <ItemContent>
                      <ItemTitle className="whitespace-nowrap">{gt.name}</ItemTitle>
                      <ItemDescription>
                        <span>
                          {gt.rate
                            ? `${gt.rate.bid} ₽ | ${gt.rate.bonusPerStudent} ₽/ученик`
                            : 'Без ставки'}
                        </span>
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                )}
              />
            </Field>
          )}
        />
        <Controller
          name="rateId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-select-rate">Ставка</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <CustomCombobox
                id="form-rhf-select-rate"
                items={rates || []}
                getKey={(r) => r.id}
                getLabel={(r) => r.name}
                value={rates?.find((r) => r.id === field.value) || null}
                onValueChange={(r) => r && field.onChange(r.id)}
                placeholder="Выберите ставку"
                emptyText="Не найдены ставки"
                renderItem={(r) => (
                  <Item size="xs" className="p-0">
                    <ItemContent>
                      <ItemTitle className="whitespace-nowrap tabular-nums">{r.name}</ItemTitle>
                      <ItemDescription>
                        <span className="tabular-nums">
                          {r.bid} ₽ | {r.bonusPerStudent} ₽/ученик
                        </span>
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                )}
              />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="maxStudents"
          disabled={isPending}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="maxStudents-field">Макс. учеников</FieldLabel>
              <NumberInput
                id="maxStudents-field"
                {...field}
                min={1}
                value={field.value ?? ''}
                onChange={field.onChange}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Separator />

      {/* Секция: Расписание */}
      <section className="space-y-1">
        <h3 className="text-sm font-medium">Расписание</h3>
        <p className="text-muted-foreground text-xs">
          Дни и время занятий, дата старта и количество уроков
        </p>
      </section>
      <FieldGroup>
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Controller
            control={form.control}
            name="startDate"
            disabled={isPending}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="startDate-field">Дата старта</FieldLabel>
                <Popover modal>
                  <PopoverTrigger
                    render={<Button variant="outline" />}
                    aria-invalid={fieldState.invalid}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value
                      ? format(ymdToLocalDate(field.value), 'dd.MM.yyyy (EEEE)', { locale: ru })
                      : 'Выберите дату'}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      id="startDate-field"
                      mode="single"
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
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                {watchedStartDate && (
                  <FieldDescription>
                    День недели: {DaysOfWeek.full[ymdToLocalDate(watchedStartDate).getDay()]}
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
                <FieldLabel htmlFor="lessonCount-field">Количество занятий</FieldLabel>
                <NumberInput
                  id="lessonCount-field"
                  {...field}
                  min={1}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                {lastLessonDate && (
                  <FieldDescription>
                    Последнее занятие: {format(lastLessonDate, 'dd.MM.yyyy')}
                  </FieldDescription>
                )}
              </Field>
            )}
          />
        </div>
      </FieldGroup>

      <Separator />

      {/* Секция: Дополнительно */}
      <section className="space-y-1">
        <h3 className="text-sm font-medium">Дополнительно</h3>
        <p className="text-muted-foreground text-xs">Необязательные параметры</p>
      </section>
      <FieldGroup>
        <Controller
          control={form.control}
          name="url"
          disabled={isPending}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="url-field">Ссылка</FieldLabel>
              <Input
                id="url-field"
                {...field}
                placeholder="https://"
                value={field.value ?? ''}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Отмена
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader className="animate-spin" />}
          Создать
        </Button>
      </div>
    </form>
  )
}
