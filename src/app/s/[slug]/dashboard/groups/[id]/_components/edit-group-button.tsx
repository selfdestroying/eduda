'use client'
import { GroupType } from '@/prisma/generated/enums'
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
import { useLocationListQuery } from '@/src/data/location/location-list-query'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { DaysOfWeek } from '@/src/lib/utils'
import { editGroupSchema, EditGroupSchemaType } from '@/src/schemas/group'
import { GroupDTO } from '@/src/types/group'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Pen } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { timeSlots } from '@/src/shared/time-slots'

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
    resolver: zodResolver(editGroupSchema),
    defaultValues: {
      courseId: group.courseId,
      locationId: group.locationId!,
      time: group.time!,
      url: group.url ?? '',
      type: group.type!,
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

  if (isLocationsLoading || isCoursesLoading) {
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
          name="type"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-select-type">Тип группы</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Select
                name={field.name}
                value={field.value?.toString() || ''}
                onValueChange={field.onChange}
                itemToStringLabel={(itemValue) => {
                  const map: Record<string, string> = {
                    [GroupType.GROUP]: 'Группа',
                    [GroupType.INDIVIDUAL]: 'Индив.',
                    [GroupType.INTENSIVE]: 'Интенсив',
                    [GroupType.SPLIT]: 'Сплит',
                  }
                  return map[itemValue] ?? ''
                }}
              >
                <SelectTrigger id="form-rhf-select-type" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem key={GroupType.GROUP} value={GroupType.GROUP}>
                      Группа
                    </SelectItem>
                    <SelectItem key={GroupType.INDIVIDUAL} value={GroupType.INDIVIDUAL}>
                      Индив.
                    </SelectItem>
                    <SelectItem key={GroupType.INTENSIVE} value={GroupType.INTENSIVE}>
                      Интенсив
                    </SelectItem>
                    <SelectItem key={GroupType.SPLIT} value={GroupType.SPLIT}>
                      Сплит
                    </SelectItem>
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
