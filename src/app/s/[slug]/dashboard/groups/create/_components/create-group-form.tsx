'use client'

import { Controller, useFieldArray, useForm } from 'react-hook-form'

import { createGroup } from '@/src/actions/groups'
import { Button } from '@/src/components/ui/button'
import { Calendar, CalendarDayButton } from '@/src/components/ui/calendar'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { Separator } from '@/src/components/ui/separator'
import { Toggle } from '@/src/components/ui/toggle'
import { useMappedCourseListQuery } from '@/src/data/course/course-list-query'
import { useGroupTypeListQuery } from '@/src/data/group-type/group-type-list-query'
import { useMappedLocationListQuery } from '@/src/data/location/location-list-query'
import { useMappedMemberListQuery, useMemberListQuery } from '@/src/data/member/member-list-query'
import { useRateListQuery } from '@/src/data/rate/rate-list-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { DaysOfWeek } from '@/src/lib/utils'
import { CreateGroupSchema, CreateGroupSchemaType } from '@/src/schemas/group'
import { timeSlots } from '@/src/shared/time-slots'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarIcon, Loader } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import { toast } from 'sonner'

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
  startDate: Date | undefined,
  scheduleDays: number[],
  lessonCount: number | undefined
): Date | null {
  if (!startDate || !scheduleDays.length || !lessonCount || lessonCount <= 0) return null

  const daysSet = new Set(scheduleDays)
  const currentDate = new Date(startDate)
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
  const { data: session } = useSessionQuery()
  const organizationId = session?.organizationId ?? undefined
  const { data: mappedCourses, isLoading: isCoursesLoading } = useMappedCourseListQuery(
    organizationId!
  )
  const { data: mappedLocations, isLoading: isLocationsLoading } = useMappedLocationListQuery(
    organizationId!
  )
  const { data: mappedMembers, isLoading: isMappedMembersLoading } = useMappedMemberListQuery(
    organizationId!
  )
  const { data: members, isLoading: isMembersLoading } = useMemberListQuery(organizationId!)
  const { data: rates, isLoading: isRatesLoading } = useRateListQuery(organizationId!)
  const { data: groupTypes, isLoading: isGroupTypesLoading } = useGroupTypeListQuery(
    organizationId!
  )
  const [isPending, startTransition] = useTransition()

  const form = useForm<CreateGroupSchemaType>({
    resolver: zodResolver(CreateGroupSchema),
    defaultValues: {
      name: '',
      url: undefined,
      groupTypeId: undefined,
      startDate: undefined,
      course: undefined,
      location: undefined,
      teacher: undefined,
      rate: undefined,
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
    form.setValue('rate', {
      value: rate.id.toString(),
      label:
        rate.bonusPerStudent > 0
          ? `${rate.name} (${rate.bid} ₽ + ${rate.bonusPerStudent} ₽/уч.)`
          : `${rate.name} (${rate.bid} ₽)`,
    })
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
    startTransition(() => {
      const { course, location, teacher, rate, startDate, lessonCount, url, schedule } = values
      const member = members?.find((m) => m.userId === Number(teacher.value))

      const sortedSchedule = [...schedule].sort(
        (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
      )
      const scheduleDaysMap = new Map(sortedSchedule.map((s) => [s.dayOfWeek, s.time]))

      // Генерация уроков: итерируем по дням от startDate
      const lessons: Array<{ date: Date; time: string; organizationId: number }> = []
      const currentDate = new Date(startDate)
      const maxIterations = (lessonCount ?? 0) * 7 + 7

      for (let i = 0; i < maxIterations && lessons.length < (lessonCount ?? 0); i++) {
        const time = scheduleDaysMap.get(currentDate.getDay())
        if (time) {
          lessons.push({
            date: new Date(currentDate),
            time,
            organizationId: organizationId!,
          })
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }

      const primaryDay = sortedSchedule[0]

      const ok = createGroup(
        {
          data: {
            groupTypeId: values.groupTypeId,
            url,
            time: primaryDay.time,
            organizationId: organizationId!,
            courseId: Number(course.value),
            locationId: Number(location.value),
            maxStudents: values.maxStudents,
            teachers: {
              create: [
                {
                  organizationId: organizationId!,
                  teacherId: Number(member?.userId) as number,
                  rateId: Number(rate.value),
                },
              ],
            },
            lessons: { createMany: { data: lessons } },
            startDate: startDate,
            dayOfWeek: primaryDay.dayOfWeek,
          },
        },
        sortedSchedule.map((s) => ({ dayOfWeek: s.dayOfWeek, time: s.time }))
      )

      toast.promise(ok, {
        loading: 'Создание группы...',
        success: 'Группа успешно создана!',
        error: 'Не удалось создать группу. Попробуйте еще раз.',
        finally: () => {
          form.reset()
          router.push('/dashboard/groups')
        },
      })
    })
  }

  if (
    isMappedMembersLoading ||
    isLocationsLoading ||
    isCoursesLoading ||
    isMembersLoading ||
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
            name="course"
            disabled={isPending}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="courseId-field">Курс</FieldLabel>
                <Select
                  items={mappedCourses}
                  {...field}
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  isItemEqualToValue={(itemValue, value) => itemValue.value === value.value}
                >
                  <SelectTrigger id="courseId-field" aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Выберите курс" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {mappedCourses?.map((course) => (
                        <SelectItem key={course.value} value={course}>
                          {course.label}
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
            name="location"
            disabled={isPending}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="locationId-field">Локация</FieldLabel>
                <Select
                  items={mappedLocations}
                  {...field}
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  isItemEqualToValue={(itemValue, value) => itemValue.value === value.value}
                >
                  <SelectTrigger id="locationId-field" aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Выберите локацию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {mappedLocations?.map((location) => (
                        <SelectItem key={location.value} value={location}>
                          {location.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <Controller
          control={form.control}
          name="teacher"
          disabled={isPending}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="teacherId-field">Преподаватель</FieldLabel>
              <Select
                items={mappedMembers}
                {...field}
                value={field.value || ''}
                onValueChange={field.onChange}
                isItemEqualToValue={(itemValue, value) => itemValue.value === value.value}
              >
                <SelectTrigger id="teacherId-field" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите преподавателя" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {mappedMembers?.map((teacher) => (
                      <SelectItem key={teacher.value} value={teacher}>
                        {teacher.label}
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
          name="groupTypeId"
          disabled={isPending}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="groupType-field">Тип группы</FieldLabel>
              <Select
                name={field.name}
                value={field.value?.toString() || ''}
                onValueChange={(value) => field.onChange(Number(value))}
                itemToStringLabel={(itemValue) =>
                  groupTypes?.find((gt) => gt.id === Number(itemValue))?.name || ''
                }
              >
                <SelectTrigger id="groupType-field" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите тип группы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {groupTypes?.map((gt) => (
                      <SelectItem key={gt.id} value={gt.id.toString()}>
                        {gt.name}
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
          name="rate"
          disabled={isPending}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="rateId-field">Ставка</FieldLabel>
              {isRatesLoading ? (
                <div className="text-muted-foreground text-sm">Загрузка...</div>
              ) : (
                <Select
                  items={
                    rates?.map((r) => ({
                      value: r.id.toString(),
                      label:
                        r.bonusPerStudent > 0
                          ? `${r.name} (${r.bid} ₽ + ${r.bonusPerStudent} ₽/уч.)`
                          : `${r.name} (${r.bid} ₽)`,
                    })) ?? []
                  }
                  {...field}
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  isItemEqualToValue={(itemValue, value) => itemValue.value === value.value}
                >
                  <SelectTrigger id="rateId-field" aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Выберите ставку" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {rates?.map((r) => (
                        <SelectItem
                          key={r.id}
                          value={{
                            value: r.id.toString(),
                            label:
                              r.bonusPerStudent > 0
                                ? `${r.name} (${r.bid} ₽ + ${r.bonusPerStudent} ₽/уч.)`
                                : `${r.name} (${r.bid} ₽)`,
                          }}
                        >
                          {r.name} — {r.bid} ₽
                          {r.bonusPerStudent > 0 && ` + ${r.bonusPerStudent} ₽/уч.`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
              <Input
                id="maxStudents-field"
                {...field}
                type="number"
                min={1}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(Number(e.target.value))}
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
                size="sm"
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
                        <Select
                          {...timeField}
                          items={timeSlots}
                          value={timeField.value || ''}
                          onValueChange={timeField.onChange}
                        >
                          <SelectTrigger className="w-32" aria-invalid={fieldState.invalid}>
                            <SelectValue placeholder="Время" />
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
                      ? format(field.value, 'dd.MM.yyyy (EEEE)', { locale: ru })
                      : 'Выберите дату'}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      id="startDate-field"
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
                  </PopoverContent>
                </Popover>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                {watchedStartDate && (
                  <FieldDescription>
                    День недели: {DaysOfWeek.full[watchedStartDate.getDay()]}
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
                <Input
                  id="lessonCount-field"
                  {...field}
                  type="number"
                  min={1}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(Number(e.target.value))}
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
