'use client'
import { Prisma } from '@/prisma/generated/client'
import { createTeacherGroup } from '@/src/actions/groups'
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
import { Skeleton } from '@/src/components/ui/skeleton'
import { Switch } from '@/src/components/ui/switch'
import { useMappedMemberListQuery } from '@/src/data/member/member-list-query'
import { useMappedRateListQuery } from '@/src/data/rate/rate-list-query'
import { useSessionQuery } from '@/src/data/user/session-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import { AddTeacherToGroupSchema, AddTeacherToGroupSchemaType } from '@/src/schemas/teacher-group'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface AddTeacherToGroupButtonProps {
  group: Prisma.GroupGetPayload<{
    include: {
      groupType: {
        include: {
          rate: true
        }
      }
    }
  }>
}

export default function AddTeacherToGroupButton({ group }: AddTeacherToGroupButtonProps) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const defaultRate = group.groupType
    ? {
        value: group.groupType.rate.id.toString(),
        label:
          group.groupType.rate.bonusPerStudent > 0
            ? `${group.groupType.rate.name} (${group.groupType.rate.bid} ₽ + ${group.groupType.rate.bonusPerStudent} ₽/уч.)`
            : `${group.groupType.rate.name} (${group.groupType.rate.bid} ₽)`,
      }
    : undefined

  const form = useForm<AddTeacherToGroupSchemaType>({
    resolver: zodResolver(AddTeacherToGroupSchema),
    defaultValues: {
      teacher: undefined,
      rate: defaultRate,
      isApplyToLesson: true,
    },
  })

  const handleSubmit = (data: AddTeacherToGroupSchemaType) => {
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
  form: ReturnType<typeof useForm<AddTeacherToGroupSchemaType>>
  onSubmit: (data: AddTeacherToGroupSchemaType) => void
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
              <Combobox
                items={rates}
                value={field.value}
                onValueChange={field.onChange}
                isItemEqualToValue={(a, b) => a?.value === b?.value}
              >
                <ComboboxInput
                  id="form-rhf-select-rate"
                  aria-invalid={fieldState.invalid}
                  placeholder="Выберите ставку"
                />
                <ComboboxContent>
                  <ComboboxEmpty>Не найдены ставки</ComboboxEmpty>
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
                <FieldLabel htmlFor="toggle-apply-to-lessons">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Применить к урокам</FieldTitle>
                      <FieldDescription>
                        Добавит преподавателя во все будущие уроки, привязанные к этой группе
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
