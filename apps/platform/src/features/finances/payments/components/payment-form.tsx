'use client'

import { CustomCombobox } from '@repo/ui/components/custom-combobox'
import { Hint } from '@repo/ui/components/hint'
import { NumberInput } from '@repo/ui/components/number-input'
import { Button } from '@repo/ui/components/button'
import { Calendar } from '@repo/ui/components/calendar'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/components/field'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@repo/ui/components/item'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'
import { dateToYmd, ymdToLocalDate } from '@/src/lib/timezone'
import { getFullName } from '@/src/lib/utils'
import { ru } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import {
  Controller,
  type FieldValues,
  type Path,
  type UseFormReturn,
  useWatch,
} from 'react-hook-form'
import { useMemberListQuery } from '@/src/features/organization/members/queries'
import { useSessionQuery } from '@/src/features/users/me/queries'
import { useActivePaymentMethodListQuery } from '../../payment-methods/queries'
import { useStudentForPaymentListQuery } from '../queries'

interface PaymentFormProps<T extends FieldValues> {
  form: UseFormReturn<T>
  formId: string
  disabled?: boolean
}

export default function PaymentForm<T extends FieldValues>({
  form,
  formId,
  disabled,
}: PaymentFormProps<T>) {
  const { data: students = [] } = useStudentForPaymentListQuery()
  const { data: paymentMethods = [] } = useActivePaymentMethodListQuery()
  const { data: memberList = [] } = useMemberListQuery()
  const { data: session } = useSessionQuery()

  const members = memberList.map((m) => ({ id: m.userId, name: m.user.name }))

  // По умолчанию продавец — тот, кто вносит оплату. Подставляем ровно один раз, когда
  // список сотрудников приехал: следить за самим полем нельзя — очистка вернула бы
  // текущего пользователя обратно, и оплату без продавца завести было бы невозможно.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current) return
    const currentUserId = Number(session?.user?.id)
    if (!currentUserId || !memberList.some((m) => m.userId === currentUserId)) return

    prefilled.current = true
    if (form.getValues('managerId' as Path<T>) == null) {
      form.setValue('managerId' as Path<T>, currentUserId as never)
    }
  }, [memberList, session, form])

  const selectedStudent = useWatch({ control: form.control, name: 'studentId' as Path<T> }) as
    | number
    | undefined

  // Подписи кошельков собирает сервер (`getWalletLabel`) — здесь остаётся только
  // разложить их в форму комбобокса.
  const mappedWallets = useMemo(() => {
    if (!selectedStudent) return []
    const student = students.find((s) => s.id === selectedStudent)
    if (!student) return []
    return student.wallets.map((w) => ({ label: w.label, value: w.id }))
  }, [selectedStudent, students])

  interface PaymentMethodOption {
    id: number
    name: string
    commission: number
  }

  const mappedPaymentMethods = useMemo<PaymentMethodOption[]>(() => {
    return [
      { id: 0, name: 'Неизвестно', commission: 0 },
      ...paymentMethods.map((m) => ({ id: m.id, name: m.name, commission: m.commission })),
    ]
  }, [paymentMethods])

  return (
    <form id={formId}>
      <FieldGroup className="gap-2">
        <Controller
          name={'studentId' as Path<T>}
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-student`}>Студент</FieldLabel>
              <CustomCombobox
                items={students}
                getKey={(s) => s.id}
                getLabel={(s) => getFullName(s.firstName, s.lastName)}
                value={students.find((s) => s.id === field.value) || null}
                onValueChange={(s) => s && field.onChange(s.id)}
                id={`${formId}-student`}
                placeholder="Выберите студента"
                emptyText="Нет доступных студентов"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name={'wallet' as Path<T>}
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-wallet`}>Кошелёк</FieldLabel>
              <CustomCombobox
                items={mappedWallets}
                value={(field.value || null) as { value: number; label: string } | null}
                onValueChange={field.onChange}
                isItemEqualToValue={(a, b) => a?.value === b?.value}
                id={`${formId}-wallet`}
                disabled={!selectedStudent}
                emptyText="Нет доступных кошельков"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'lessonCount' as Path<T>}
          disabled={disabled}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-lessonCount`}>Количество занятий</FieldLabel>
              <NumberInput
                id={`${formId}-lessonCount`}
                {...field}
                onChange={field.onChange}
                value={field.value ?? ''}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'price' as Path<T>}
          disabled={disabled}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-price`}>Сумма</FieldLabel>
              <NumberInput
                id={`${formId}-price`}
                {...field}
                onChange={field.onChange}
                value={field.value ?? ''}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'date' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>Дата</FieldLabel>
              <Popover>
                <PopoverTrigger
                  render={<Button variant="outline" className="w-full font-normal" />}
                >
                  <CalendarIcon />
                  {field.value ? field.value : 'Выберите день'}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    onSelect={(value) => value && field.onChange(dateToYmd(value))}
                    locale={ru}
                    selected={field.value ? ymdToLocalDate(field.value) : undefined}
                  />
                </PopoverContent>
              </Popover>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'managerId' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-manager`}>
                Менеджер
                <Hint text="Кто продал этот пакет. По умолчанию — вы; поменяйте, если оплату вносите за коллегу." />
              </FieldLabel>
              <CustomCombobox
                items={members}
                getKey={(m) => m!.id}
                getLabel={(m) => m!.name}
                value={members.find((m) => m.id === field.value) ?? null}
                onValueChange={(m) => field.onChange(m?.id ?? null)}
                id={`${formId}-manager`}
                placeholder="Выберите менеджера"
                emptyText="Нет сотрудников"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name={'paymentMethodId' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-paymentMethod`}>
                Метод оплаты (необязательно)
                <Hint text="Если нужного метода нет в списке, обратитесь к владельцу для создания нового метода оплаты" />
              </FieldLabel>
              <CustomCombobox
                items={mappedPaymentMethods}
                value={
                  mappedPaymentMethods.find((m) => m.id === (field.value ?? 0)) ??
                  mappedPaymentMethods[0]
                }
                getKey={(item) => item!.id}
                getLabel={(item) => item!.name}
                onValueChange={(item) => field.onChange(item && item.id !== 0 ? item.id : null)}
                id={`${formId}-paymentMethod`}
                placeholder="Выберите метод оплаты"
                emptyText="Нет доступных методов оплаты"
                renderItem={(item) => (
                  <Item size="xs" className="p-0">
                    <ItemContent>
                      <ItemTitle className="whitespace-nowrap">{item!.name}</ItemTitle>
                      {item!.commission > 0 && (
                        <ItemDescription>
                          <span className="tabular-nums">{item!.commission} %</span>
                        </ItemDescription>
                      )}
                    </ItemContent>
                  </Item>
                )}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
