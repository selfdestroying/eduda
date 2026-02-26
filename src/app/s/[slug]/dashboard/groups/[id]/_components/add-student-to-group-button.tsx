'use client'
import { Group } from '@/prisma/generated/client'
import { createStudentGroup } from '@/src/actions/groups'
import { getStudents } from '@/src/actions/students'
import { Button } from '@/src/components/ui/button'
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
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/src/components/ui/field'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/src/components/ui/item'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Switch } from '@/src/components/ui/switch'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { cn, getFullName, getGroupName } from '@/src/lib/utils'
import { GroupDTO } from '@/src/types/group'
import { StudentDTO } from '@/src/types/student'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'

import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import z from 'zod/v4'

interface AddStudentToGroupButtonProps {
  students?: StudentDTO[]
  excludeStudentIds?: number[]
  group?: Group
  groups?: GroupDTO[]
  student?: StudentDTO
  isFull?: boolean
}

const Schema = z.object({
  target: z.object(
    {
      label: z.string(),
      value: z.number(),
    },
    'Выберите значение'
  ),
  isApplyToLesson: z.boolean(),
})

type SchemaType = z.infer<typeof Schema>

export default function AddStudentToGroupButton({
  students: studentsProp,
  excludeStudentIds,
  group,
  groups,
  student,
  isFull,
}: AddStudentToGroupButtonProps) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId ?? undefined
  const { data: hasPermission } = useOrganizationPermissionQuery({ studentGroup: ['create'] })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [lazyStudents, setLazyStudents] = useState<StudentDTO[] | null>(null)

  const isAddToGroup = !!group && (!!studentsProp || !!excludeStudentIds)
  const isAddToStudent = !!student && !!groups

  useEffect(() => {
    startTransition(() => {
      if (!dialogOpen || !isAddToGroup || studentsProp || !organizationId || !excludeStudentIds)
        return
      getStudents({
        where: {
          organizationId,
          NOT: { id: { in: excludeStudentIds } },
        },
      }).then((data) => {
        setLazyStudents(data as StudentDTO[])
      })
    })
  }, [dialogOpen, isAddToGroup, studentsProp, organizationId, excludeStudentIds])

  const students = studentsProp ?? lazyStudents

  const items = useMemo(() => {
    if (isAddToGroup && students) {
      return students.map((s) => ({
        label: getFullName(s.firstName, s.lastName),
        value: s.id,
        itemType: 'student' as const,
      }))
    }
    if (isAddToStudent && groups) {
      return groups.map((g) => ({
        label: `${getGroupName(g)}`,
        itemType: 'group' as const,
        teachers: `${g.teachers.map((t) => t.teacher.name).join(', ')}`,
        location: g.location.name,
        students: g.students.length,
        maxStudents: g.maxStudents,
        value: g.id,
        disabled: g.students.length >= g.maxStudents,
      }))
    }
    return []
  }, [isAddToGroup, isAddToStudent, students, groups])

  const form = useForm<SchemaType>({
    resolver: zodResolver(Schema),
    defaultValues: {
      target: undefined,
      isApplyToLesson: true,
    },
  })

  const handleSubmit = (data: SchemaType) => {
    startTransition(() => {
      const { isApplyToLesson, target } = data

      const groupId = isAddToGroup ? group!.id : target.value
      const studentId = isAddToGroup ? target.value : student!.id

      const ok = createStudentGroup(
        {
          data: {
            organizationId: organizationId!,
            groupId,
            studentId,
            status: 'ACTIVE',
          },
        },
        isApplyToLesson
      )
      const successMessage = isAddToGroup
        ? 'Студент успешно добавлен в группу!'
        : 'Группа успешно добавлена студенту!'

      toast.promise(ok, {
        loading: 'Добавление...',
        success: successMessage,
        error: 'Не удалось добавить.',
        finally: () => setDialogOpen(false),
      })
    })
  }

  useEffect(() => {
    form.reset()
  }, [dialogOpen, form])

  if ((!isAddToGroup && !isAddToStudent) || !hasPermission) return null

  const isGroupFull = isAddToGroup && isFull

  const dialogTitle = isAddToGroup ? 'Добавить студента' : 'Добавить в группу'
  const label = isAddToGroup ? 'Студент' : 'Группа'
  const emptyMessage = isAddToGroup ? 'Нет доступных студентов' : 'Нет доступных групп'

  if (isSessionLoading) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger
        render={
          <Button
            size={'icon'}
            disabled={isGroupFull}
            title={isGroupFull ? 'Группа заполнена' : undefined}
          />
        }
      >
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <AddEntityForm
          form={form}
          items={items}
          label={label}
          emptyMessage={emptyMessage}
          onSubmit={handleSubmit}
        />

        <DialogFooter>
          <Button variant="secondary" onClick={() => setDialogOpen(false)} size={'sm'}>
            Отмена
          </Button>
          <Button disabled={isPending} type="submit" form="add-entity-form" size={'sm'}>
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AddEntityFormProps {
  form: ReturnType<typeof useForm<SchemaType>>
  items: {
    label: string
    value: number
    description?: string
    disabled?: boolean
    itemType?: 'student' | 'group'
  }[]
  label: string
  emptyMessage: string
  onSubmit: (data: SchemaType) => void
}

function AddEntityForm({ form, items, label, emptyMessage, onSubmit }: AddEntityFormProps) {
  return (
    <form id="add-entity-form" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-2">
        <Controller
          name="target"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="form-rhf-select-target">{label}</FieldLabel>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              <Combobox
                items={items}
                value={field.value || ''}
                onValueChange={field.onChange}
                isItemEqualToValue={(itemValue, selectedValue) =>
                  itemValue.value === selectedValue.value
                }
              >
                <ComboboxInput id="form-rhf-select-target" aria-invalid={fieldState.invalid} />
                <ComboboxContent>
                  <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item.value} value={item} disabled={item.disabled}>
                        {item.itemType === 'group' ? (
                          <Item size="xs" className="p-0">
                            <ItemContent>
                              <ItemTitle className="whitespace-nowrap">{item.label}</ItemTitle>
                              <ItemDescription>
                                {item.teachers} | {item.location} |{' '}
                                <span
                                  className={cn(
                                    'tabular-nums',
                                    item.disabled && 'text-destructive'
                                  )}
                                >
                                  {item.students}/{item.maxStudents}
                                </span>
                              </ItemDescription>
                            </ItemContent>
                          </Item>
                        ) : (
                          item.label
                        )}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
          )}
        />

        <Controller
          name="isApplyToLesson"
          control={form.control}
          render={({ field }) => (
            <Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="toggle-apply-to-lessons">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Применить к урокам</FieldTitle>
                      <FieldDescription>
                        Добавит студента во все будущие уроки, привязанные к этой группе
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="toggle-apply-to-lessons"
                      name={field.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </Field>
                </FieldLabel>
              </Field>
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
