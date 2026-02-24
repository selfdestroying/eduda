'use client'

import { Prisma, UnprocessedPayment } from '@/prisma/generated/client'
import { StudentFinancialField, StudentLessonsBalanceChangeReason } from '@/prisma/generated/enums'
import { deleteUnprocessedPayment, updateUnprocessedPayment } from '@/src/actions/payments'
import { updateStudentGroupBalance } from '@/src/actions/students'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog'
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
} from '@/src/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { getFullName, getGroupName } from '@/src/lib/utils'
import { AddPaymentSchema, AddPaymentSchemaType } from '@/src/schemas/payments'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, CircleX, Loader2, MoreVertical } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

type StudentWithGroups = Prisma.StudentGetPayload<{
  include: {
    groups: {
      include: {
        group: { include: { course: true; location: true } }
      }
    }
  }
}>

interface PaymentsActionsProps {
  students: StudentWithGroups[]
  unprocessedPayment: UnprocessedPayment
}

export default function UnprocessedPaymentsActions({
  students,
  unprocessedPayment,
}: PaymentsActionsProps) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const mappedStudents = useMemo(
    () =>
      students.map((student) => ({
        label: getFullName(student.firstName, student.lastName),
        value: student.id,
      })),
    [students]
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const form = useForm<AddPaymentSchemaType>({
    resolver: zodResolver(AddPaymentSchema),
    defaultValues: {
      price: undefined,
      lessonCount: undefined,
      leadName: undefined,
      productName: undefined,
    },
  })

  const selectedStudent = useWatch({ control: form.control, name: 'student' })

  const mappedGroups = useMemo(() => {
    if (!selectedStudent?.value) return []
    const student = students.find((s) => s.id === selectedStudent.value)
    if (!student) return []
    return student.groups.map((sg) => ({
      label: getGroupName(sg.group),
      value: sg.groupId,
    }))
  }, [selectedStudent, selectedStudent?.value, students])

  const onSubmit = (values: AddPaymentSchemaType) => {
    startTransition(() => {
      const { student, group, ...payload } = values
      const paymentMeta = {
        lessonCount: payload.lessonCount,
        price: payload.price,
        leadName: payload.leadName,
        productName: payload.productName,
        groupId: group.value,
        unprocessedPaymentId: unprocessedPayment.id,
      }
      const ok = updateStudentGroupBalance(
        student.value,
        group.value,
        {
          lessonsBalance: { increment: payload.lessonCount },
          totalLessons: { increment: payload.lessonCount },
          totalPayments: { increment: payload.price },
        },
        {
          [StudentFinancialField.LESSONS_BALANCE]: {
            reason: StudentLessonsBalanceChangeReason.PAYMENT_CREATED,
            meta: paymentMeta,
          },
          [StudentFinancialField.TOTAL_PAYMENTS]: {
            reason: StudentLessonsBalanceChangeReason.PAYMENT_CREATED,
            meta: paymentMeta,
          },
          [StudentFinancialField.TOTAL_LESSONS]: {
            reason: StudentLessonsBalanceChangeReason.PAYMENT_CREATED,
            meta: paymentMeta,
          },
        },
        {
          lessonCount: payload.lessonCount,
          price: payload.price,
          bidForLesson: payload.price / payload.lessonCount,
          leadName: payload.leadName,
          productName: payload.productName,
        }
      ).then(() =>
        updateUnprocessedPayment({
          where: { id: unprocessedPayment?.id },
          data: { resolved: true },
        })
      )
      toast.promise(ok, {
        loading: 'Создание оплаты...',
        success: 'Оплата успешно создана!',
        error: 'Не удалось создать оплату.',
        finally: () => {
          setDialogOpen(false)
          form.reset()
        },
      })
    })
  }

  const handleDelete = () => {
    startTransition(() => {
      const ok = deleteUnprocessedPayment({
        where: { id: unprocessedPayment.id },
      })
      toast.promise(ok, {
        loading: 'Удаление неразобранной оплаты...',
        success: 'Неразобранная оплата успешно удалена',
        error: 'Не удалось удалить неразобранную оплату',
      })
    })
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreVertical />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-max">
          <DropdownMenuItem
            onClick={() => {
              setDialogOpen(true)
              setOpen(false)
            }}
          >
            <Check />
            Разобрать оплату
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setConfirmOpen(true)
              setOpen(false)
            }}
          >
            <CircleX />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Вы уверены, что хотите удалить неразобранную оплату?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Это действие удалит оплату и не может быть отменено.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
              {isPending ? <Loader2 className="animate-spin" /> : 'Удалить'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить оплату</DialogTitle>
          </DialogHeader>
          <form id="payment-form" onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup className="gap-2">
              <Controller
                name="student"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="form-rhf-select-student">Студент</FieldLabel>
                    <Combobox
                      items={mappedStudents}
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      isItemEqualToValue={(itemValue, selectedValue) =>
                        itemValue.value === selectedValue.value
                      }
                    >
                      <ComboboxInput
                        id="form-rhf-select-student"
                        aria-invalid={fieldState.invalid}
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>Нет доступных студентов</ComboboxEmpty>
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
                name="group"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="form-rhf-select-group">Группа</FieldLabel>
                    <Combobox
                      items={mappedGroups}
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      isItemEqualToValue={(itemValue, selectedValue) =>
                        itemValue.value === selectedValue.value
                      }
                    >
                      <ComboboxInput
                        id="form-rhf-select-group"
                        aria-invalid={fieldState.invalid}
                        disabled={!selectedStudent?.value}
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>Нет доступных групп</ComboboxEmpty>
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
                control={form.control}
                name="lessonCount"
                disabled={isPending}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="lesson-count-field">Количество занятий</FieldLabel>
                    <Input
                      id="lesson-count-field"
                      {...field}
                      type="number"
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      value={field.value ?? ''}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="price"
                disabled={isPending}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="price-field">Сумма</FieldLabel>
                    <Input
                      id="price-field"
                      {...field}
                      type="number"
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      value={field.value ?? ''}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="leadName"
                disabled={isPending}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="lead-name-field">Имя лида</FieldLabel>
                    <Input
                      id="lead-name-field"
                      {...field}
                      type="text"
                      onChange={(e) => field.onChange(e.target.value)}
                      value={field.value ?? ''}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="productName"
                disabled={isPending}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="product-name-field">Название продукта</FieldLabel>
                    <Input
                      id="product-name-field"
                      {...field}
                      type="text"
                      onChange={(e) => field.onChange(e.target.value)}
                      value={field.value ?? ''}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} size={'sm'}>
              Отмена
            </Button>
            <Button disabled={isPending} type="submit" form="payment-form" size={'sm'}>
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
