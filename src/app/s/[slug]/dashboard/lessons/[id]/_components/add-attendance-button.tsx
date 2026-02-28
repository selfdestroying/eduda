'use client'
import { Student } from '@/prisma/generated/client'
import { createAttendance } from '@/src/actions/attendance'
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/data/user/session-query'
import { CreateAttendanceSchema, CreateAttendanceSchemaType } from '@/src/schemas/attendance'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface AddAttendanceButtonProps {
  lessonId: number
  students: Student[]
  isFull?: boolean
}

const studentStatusMap = {
  ACTIVE: 'Активен',
  TRIAL: 'Пробный',
}

export default function AddAttendanceButton({
  lessonId,
  students,
  isFull,
}: AddAttendanceButtonProps) {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const organizationId = session?.organizationId ?? undefined
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const form = useForm<CreateAttendanceSchemaType>({
    resolver: zodResolver(CreateAttendanceSchema),
    defaultValues: {
      target: undefined,
      studentStatus: undefined,
    },
  })

  const handleSubmit = (data: CreateAttendanceSchemaType) => {
    startTransition(() => {
      const { studentStatus, target } = data
      const ok = createAttendance({
        organizationId: organizationId!,
        lessonId,
        studentId: target.value,
        studentStatus: studentStatus,
        status: 'UNSPECIFIED',
        comment: '',
      })

      toast.promise(ok, {
        loading: 'Добавление ученика...',
        success: 'Ученик успешно добавлен в посещаемость',
        error: 'Не удалось добавить ученика в посещаемость',
        finally: () => {
          setOpen(false)
          form.reset()
        },
      })
    })
  }

  if (isSessionLoading) {
    return <Skeleton className="h-full w-full" />
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size={'icon'} disabled={isFull} title={isFull ? 'Урок заполнен' : undefined} />
        }
      >
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить ученика</DialogTitle>
        </DialogHeader>
        <DialogDescription></DialogDescription>

        <AddAttendanceForm
          form={form}
          items={students.map((student) => ({
            label: `${student.firstName} ${student.lastName ?? ''}`.trim(),
            value: student.id,
          }))}
          label="Ученик"
          emptyMessage="Нет доступных учеников"
          onSubmit={handleSubmit}
        />
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Отмена
              </Button>
            }
          />
          <Button form="add-attendance-form" type="submit" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AddAttendanceFormProps {
  form: ReturnType<typeof useForm<CreateAttendanceSchemaType>>
  items: { label: string; value: number }[]
  label: string
  emptyMessage: string
  onSubmit: (data: CreateAttendanceSchemaType) => void
}

function AddAttendanceForm({ form, items, label, emptyMessage, onSubmit }: AddAttendanceFormProps) {
  return (
    <form id="add-attendance-form" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-2">
        <Controller
          name="target"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="form-rhf-select-target">{label}</FieldLabel>

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
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="studentStatus"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="form-rhf-select-student-status">Статус</FieldLabel>
              <Select
                id="form-rhf-select-student-status"
                value={field.value || ''}
                onValueChange={field.onChange}
                itemToStringLabel={(itemValue) => studentStatusMap[itemValue]}
              >
                <SelectTrigger aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Выберите статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(studentStatusMap).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
