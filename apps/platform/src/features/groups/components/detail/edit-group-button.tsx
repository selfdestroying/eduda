'use client'

import { CustomCombobox } from '@/src/components/custom-combobox'
import { NumberInput } from '@/src/components/number-input'
import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog'
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useCourseListQuery } from '@/src/features/courses/queries'
import { useGroupTypeListQuery } from '@/src/features/group-types/queries'
import { useLocationListQuery } from '@/src/features/locations/queries'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useGroupUpdateMutation } from '../../queries'
import type { UpdateGroupSchemaType } from '../../schemas'
import { UpdateGroupSchema } from '../../schemas'
import type { GroupDetailFull } from '../../types'

interface EditGroupDialogProps {
  group: GroupDetailFull
  isOpen: boolean
  onClose: () => void
}

export default function EditGroupDialog({ group, isOpen, onClose }: EditGroupDialogProps) {
  const updateMutation = useGroupUpdateMutation()
  const form = useForm<UpdateGroupSchemaType>({
    resolver: zodResolver(UpdateGroupSchema),
    defaultValues: {
      id: group.id,
      courseId: group.courseId,
      locationId: group.locationId!,
      url: group.url ?? '',
      groupTypeId: group.groupTypeId ?? undefined,
      maxStudents: group.maxStudents ?? undefined,
    },
  })

  const handleSubmit = (data: UpdateGroupSchemaType) => {
    updateMutation.mutate({ ...data, id: group.id }, { onSuccess: () => onClose() })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать группу</DialogTitle>
        </DialogHeader>
        <EditGroupForm form={form} onSubmit={handleSubmit} />
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button form="edit-group-form" type="submit" disabled={updateMutation.isPending}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface EditGroupFormProps {
  form: ReturnType<typeof useForm<UpdateGroupSchemaType>>
  onSubmit: (data: UpdateGroupSchemaType) => void
}

function EditGroupForm({ form, onSubmit }: EditGroupFormProps) {
  const { data: locations, isLoading: isLocationsLoading } = useLocationListQuery()
  const { data: courses, isLoading: isCoursesLoading } = useCourseListQuery()
  const { data: groupTypes, isLoading: isGroupTypesLoading } = useGroupTypeListQuery()

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
          name="maxStudents"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-maxStudents">Максимум учеников</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <NumberInput
                id="form-rhf-maxStudents"
                min={1}
                value={field.value ?? ''}
                onChange={field.onChange}
                aria-invalid={fieldState.invalid}
              />
            </Field>
          )}
        />
        <Controller
          name="url"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-url">Ссылка в БО</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Input id="form-rhf-url" type="url" {...field} value={field.value ?? ''} />
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
