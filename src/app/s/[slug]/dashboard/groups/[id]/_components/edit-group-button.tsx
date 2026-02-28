'use client'
import { Prisma } from '@/prisma/generated/client'
import { updateGroup } from '@/src/actions/groups'
import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import { useCourseListQuery } from '@/src/data/course/course-list-query'
import { useGroupTypeListQuery } from '@/src/data/group-type/group-type-list-query'
import { useLocationListQuery } from '@/src/data/location/location-list-query'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { DaysOfWeek } from '@/src/lib/utils'
import { EditGroupSchema, EditGroupSchemaType } from '@/src/schemas/group'
import { zodResolver } from '@hookform/resolvers/zod'

type GroupDTO = Prisma.GroupGetPayload<{
  include: {
    location: true
    course: true
    students: true
    schedules: true
    groupType: { include: { rate: true } }
    teachers: { include: { teacher: true } }
  }
}>

import { timeSlots } from '@/src/shared/time-slots'
import { AlertTriangle, Pen } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface EditGroupButtonProps {
  group: GroupDTO
}

export default function EditGroupButton({ group }: EditGroupButtonProps) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId
  const { data: hasPermission } = useOrganizationPermissionQuery({ group: ['update'] })
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const form = useForm<EditGroupSchemaType>({
    resolver: zodResolver(EditGroupSchema),
    defaultValues: {
      courseId: group.courseId,
      locationId: group.locationId!,
      time: group.time!,
      url: group.url ?? '',
      groupTypeId: group.groupTypeId ?? undefined,
      dayOfWeek: group.dayOfWeek!,
    },
  })

  const handleSubmit = (data: EditGroupSchemaType) => {
    startTransition(() => {
      const ok = updateGroup({ where: { id: group.id }, data })
      toast.promise(ok, {
        loading: 'Сохранение изменений...',
        success: 'Группа успешно обновлена!',
        error: 'Ошибка при обновлении группы.',
        finally: () => setDialogOpen(false),
      })
    })
  }
  if (isSessionLoading || !session) {
    return <Skeleton className="h-full w-full" />
  }

  if (!hasPermission?.success) {
    return null
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger render={<Button size={'icon'} />}>
        <Pen />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать группу</DialogTitle>
        </DialogHeader>
        <EditGroupForm form={form} onSubmit={handleSubmit} organizationId={organizationId!} />
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDialogOpen(false)} size={'sm'}>
            Отмена
          </Button>
          <Button form="edit-group-form" type="submit" disabled={isPending} size={'sm'}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface EditGroupFormProps {
  form: ReturnType<typeof useForm<EditGroupSchemaType>>
  onSubmit: (data: EditGroupSchemaType) => void
  organizationId: number
}

function EditGroupForm({ form, onSubmit, organizationId }: EditGroupFormProps) {
  const { data: locations, isLoading: isLocationsLoading } = useLocationListQuery(organizationId)
  const { data: courses, isLoading: isCoursesLoading } = useCourseListQuery(organizationId)
  const { data: groupTypes, isLoading: isGroupTypesLoading } = useGroupTypeListQuery(organizationId)

  if (isLocationsLoading || isCoursesLoading || isGroupTypesLoading) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <form id="edit-group-form" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-2">
        <Controller
          name="courseId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-select-course">Курс</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Select
                name={field.name}
                value={field.value?.toString() || ''}
                onValueChange={(value) => field.onChange(Number(value))}
                itemToStringLabel={(itemValue) =>
                  courses?.find((course) => course.id === Number(itemValue))?.name || ''
                }
              >
                <SelectTrigger id="form-rhf-select-course" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите курс" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {courses?.map((course) => (
                      <SelectItem key={course.id} value={course.id.toString()}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          name="locationId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-select-location">Локация</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Select
                name={field.name}
                value={field.value?.toString() || ''}
                onValueChange={(value) => field.onChange(Number(value))}
                itemToStringLabel={(itemValue) =>
                  locations?.find((location) => location.id === Number(itemValue))?.name || ''
                }
              >
                <SelectTrigger id="form-rhf-select-location" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите локацию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {locations?.map((location) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          name="time"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-select-time">Время</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Select
                name={field.name}
                value={field.value != undefined ? field.value.toString() : ''}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="form-rhf-select-time" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите время" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {timeSlots.map((timeSlot) => (
                      <SelectItem key={timeSlot.value} value={timeSlot.value}>
                        {timeSlot.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
              <Select
                name={field.name}
                value={field.value?.toString() || ''}
                onValueChange={(value) => field.onChange(Number(value))}
                itemToStringLabel={(itemValue) =>
                  groupTypes?.find((gt) => gt.id === Number(itemValue))?.name || ''
                }
              >
                <SelectTrigger id="form-rhf-select-groupType" aria-invalid={fieldState.invalid}>
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
            </Field>
          )}
        />
        <Controller
          name="dayOfWeek"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="form-rhf-select-dayOfWeek">День занятия</FieldLabel>
                  <Tooltip>
                    <TooltipTrigger
                      render={<span className="text-warning cursor-help" aria-label="Бета" />}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <b>Тестовая функция.</b> При изменении этого поля будут пересчитаны будущие
                      уроки.
                    </TooltipContent>
                  </Tooltip>
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Select
                name={field.name}
                value={field.value?.toString() || ''}
                onValueChange={(value) => field.onChange(Number(value))}
                itemToStringLabel={(itemValue) => DaysOfWeek.full[Number(itemValue)]}
              >
                <SelectTrigger id="form-rhf-select-dayOfWeek" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите день недели" />
                </SelectTrigger>
                <SelectContent>
                  {DaysOfWeek.full.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          name="url"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-input-url">Ссылка в БО</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Input
                id="form-rhf-input-url"
                type="text"
                placeholder="https://backoffice.example.com"
                {...field}
              />
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
