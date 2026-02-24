'use client'
import { Group } from '@/prisma/generated/client'
import { createTeacherGroup } from '@/src/actions/groups'
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
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useMappedMemberListQuery } from '@/src/data/member/member-list-query'
import { useMappedRateListQuery } from '@/src/data/rate/rate-list-query'
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
  teacher: z.object(
    {
      value: z.string(),
      label: z.string(),
    },
    'Преподаватель не выбран'
  ),
  rate: z.object(
    {
      value: z.string(),
      label: z.string(),
    },
    'Ставка не выбрана'
  ),
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
      teacher: undefined,
      rate: undefined,
      isApplyToLesson: false,
    },
  })

  const handleSubmit = (data: GroupTeacherSchemaType) => {
    startTransition(() => {
      const { isApplyToLesson, teacher, rate, ...payload } = data
      const ok = createTeacherGroup(
        {
          data: {
            organizationId: group.organizationId,
            groupId: group.id,
            teacherId: Number(teacher.value),
            rateId: Number(rate.value),
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
  const { data: members, isLoading: isMembersLoading } = useMappedMemberListQuery(organizationId)
  const { data: rates, isLoading: isRatesLoading } = useMappedRateListQuery(organizationId)

  if (isMembersLoading || isRatesLoading) {
    return <Skeleton className="h-full w-full" />
  }

  if (!members || !rates) {
    return (
      <div className="h-full w-full">
        <p>Не найдены преподаватели или ставки</p>
      </div>
    )
  }

  return (
    <form id="group-teacher-form" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-2">
        <Controller
          name="teacher"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-select-teacher">Преподаватель</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Combobox items={members} onValueChange={field.onChange}>
                <ComboboxInput
                  id="form-rhf-select-teacher"
                  aria-invalid={fieldState.invalid}
                  placeholder="Выберите преподавателя"
                />
                <ComboboxContent>
                  <ComboboxEmpty>Не найдены преподаватели</ComboboxEmpty>
                  <ComboboxList>
                    {(member: (typeof members)[number]) => (
                      <ComboboxItem key={member.value} value={member}>
                        {member.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
          )}
        />

        <Controller
          name="rate"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="form-rhf-select-rate">Ставка</FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
              <Combobox items={rates} onValueChange={field.onChange}>
                <ComboboxInput
                  id="form-rhf-select-teacher"
                  aria-invalid={fieldState.invalid}
                  placeholder="Выберите преподавателя"
                />
                <ComboboxContent>
                  <ComboboxEmpty>Не найдены преподаватели</ComboboxEmpty>
                  <ComboboxList>
                    {(rate: (typeof rates)[number]) => (
                      <ComboboxItem key={rate.value} value={rate}>
                        {rate.label}
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
