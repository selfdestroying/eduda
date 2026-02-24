'use client'
import { Group } from '@/prisma/generated/client'
import { createTeacherGroup } from '@/src/actions/groups'
import { Button } from '@/src/components/ui/button'
import { Checkbox } from '@/src/components/ui/checkbox'
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
import { useMemberListQuery } from '@/src/data/member/member-list-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import z from 'zod/v4'

interface AddTeacherToGroupButtonProps {
  group: Group
}

const GroupTeacherSchema = z.object({
  teacherId: z.number('Не выбран преподаватель').int().positive(),
  bid: z
    .number('Не указана ставка')
    .int('Ставка должна быть числом')
    .gte(0, 'Ставка должна быть >= 0'),
  bonusPerStudent: z
    .number('Не указан бонус')
    .int('Бонус должен быть целым числом')
    .gte(0, 'Бонус должен быть >= 0'),
  isApplyToLesson: z.boolean(),
})

type GroupTeacherSchemaType = z.infer<typeof GroupTeacherSchema>

export default function AddTeacherToGroupButton({ group }: AddTeacherToGroupButtonProps) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<GroupTeacherSchemaType>({
    resolver: zodResolver(GroupTeacherSchema),
    defaultValues: {
      teacherId: undefined,
      bid:
        group.type === 'INDIVIDUAL'
          ? 750
          : group.type === 'GROUP' || group.type === 'SPLIT'
            ? 1100
            : undefined,
      bonusPerStudent: 0,
      isApplyToLesson: false,
    },
  })

  const handleSubmit = (data: GroupTeacherSchemaType) => {
    startTransition(() => {
      const { isApplyToLesson, ...payload } = data
      const ok = createTeacherGroup(
        {
          data: {
            organizationId: group.organizationId,
            groupId: group.id,
            ...payload,
          },
        },
        isApplyToLesson
      )
      toast.promise(ok, {
        loading: 'Добавление преподавателя...',
        success: 'Преподаватель успешно добавлен в группу!',
        error: 'Не удалось добавить преподавателя в группу.',
        finally: () => setDialogOpen(false),
      })
    })
  }

  useEffect(() => {
    form.reset()
  }, [dialogOpen, form])

  if (isSessionLoading) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger render={<Button size={'icon'} />}>
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить преподавателя</DialogTitle>
        </DialogHeader>

        <GroupTeacherForm form={form} onSubmit={handleSubmit} organizationId={organizationId!} />

        <DialogFooter>
          <Button variant="secondary" onClick={() => setDialogOpen(false)} size={'sm'}>
            Отмена
          </Button>
          <Button disabled={isPending} type="submit" form="group-teacher-form" size={'sm'}>
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface GroupTeacherFormProps {
  form: ReturnType<typeof useForm<GroupTeacherSchemaType>>
  onSubmit: (data: GroupTeacherSchemaType) => void
  organizationId: number
}

function GroupTeacherForm({ form, onSubmit, organizationId }: GroupTeacherFormProps) {
  const { data: members, isLoading: isMembersLoading } = useMemberListQuery(organizationId)

  if (isMembersLoading) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <form id="group-teacher-form" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-2">
        <Controller
          name="teacherId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-select-teacher">Преподаватель</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Select
                name={field.name}
                value={field.value?.toString() || ''}
                onValueChange={(value) => field.onChange(Number(value))}
                itemToStringLabel={(itemValue) => {
                  const teacher = members?.find((t) => t.userId === Number(itemValue))
                  return teacher ? `${teacher.user.name}` : 'Выберите преподавателя'
                }}
              >
                <SelectTrigger id="form-rhf-select-teacher" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите преподавателя" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {members?.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.userId.toString()}>
                        {teacher.user.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        <Controller
          name="bid"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-input-bid">Ставка</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Input
                id="form-rhf-input-bid"
                type="number"
                {...field}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            </Field>
          )}
        />

        <Controller
          name="bonusPerStudent"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-input-bonus">Бонус за ученика</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Input
                id="form-rhf-input-bonus"
                type="number"
                {...field}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
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
