'use client'
import { Group } from '@/prisma/generated/client'
import { createStudentGroup } from '@/src/actions/groups'
import { getStudents } from '@/src/actions/students'
import { Button } from '@/src/components/ui/button'
import { Checkbox } from '@/src/components/ui/checkbox'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useOrganizationPermissionQuery } from '@/src/data/organization/organization-permission-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { getFullName, getGroupName } from '@/src/lib/utils'
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
      }))
    }
    if (isAddToStudent && groups) {
      return groups.map((g) => ({
        label: `${getGroupName(g)} (${g.students.length}/${g.maxStudents})`,
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
      isApplyToLesson: false,
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
  items: { label: string; value: number; disabled?: boolean }[]
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
                        {item.label}
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
                <FieldLabel
                  htmlFor="toggle-apply-to-lessons"
                  className="hover:bg-accent/50 flex items-start gap-2 rounded-lg border p-2 has-aria-checked:border-violet-600 has-aria-checked:bg-violet-50 dark:has-aria-checked:border-violet-900 dark:has-aria-checked:bg-violet-950"
                >
                  <Checkbox
                    id="toggle-apply-to-lessons"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600 data-[state=checked]:text-white dark:data-[state=checked]:border-violet-700 dark:data-[state=checked]:bg-violet-700"
                  />
                  <div className="grid gap-1.5 font-normal">
                    <p className="text-sm leading-none font-medium">Применить к урокам</p>
                  </div>
                </FieldLabel>
              </Field>
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
