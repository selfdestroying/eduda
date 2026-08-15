'use client'

import { useMemberListQuery } from '@/src/features/organization/members/queries'
import { useSessionQuery } from '@/src/features/users/me/queries'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { dateToYmd, todayYmdInTz, ymdToLocalDate } from '@/src/lib/timezone'
import { formatCurrency, getFullName } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/components/button'
import { Calendar } from '@repo/ui/components/calendar'
import { CustomCombobox } from '@repo/ui/components/custom-combobox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@repo/ui/components/field'
import { Hint } from '@repo/ui/components/hint'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@repo/ui/components/item'
import { NumberInput } from '@repo/ui/components/number-input'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'
import { ru } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { useActivePaymentMethodListQuery } from '../../payment-methods/queries'
import { useStudentForPaymentListQuery } from '../queries'
import { CreatePaymentSchema, type CreatePaymentSchemaType } from '../schemas'

/**
 * Пустая форма оплаты. Живёт здесь, а не у каждого потребителя: набор значений
 * по умолчанию обязан совпадать с полями формы, а потребителя два — создание
 * оплаты и разбор неразобранной.
 *
 * Дата — сегодняшний день школы. Задним числом оплату завести по-прежнему можно,
 * но вносят её обычно в тот же день, и пустое поле каждый раз требовало клика.
 */
export function usePaymentForm() {
  const tz = useOrgTimezone()

  return useForm<CreatePaymentSchemaType>({
    resolver: zodResolver(CreatePaymentSchema),
    defaultValues: {
      studentId: undefined,
      walletId: undefined,
      lessonCount: undefined,
      price: undefined,
      date: todayYmdInTz(tz),
      paymentMethodId: null,
      managerId: null,
    },
  })
}

/** «1 занятие», «2 занятия», «5 занятий» — иначе остаток читается как телеграмма. */
function formatLessons(count: number) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return `${count} занятий`
  if (mod10 === 1) return `${count} занятие`
  if (mod10 >= 2 && mod10 <= 4) return `${count} занятия`
  return `${count} занятий`
}

interface PaymentFormProps {
  form: UseFormReturn<CreatePaymentSchemaType>
  /** Связывает форму с кнопкой отправки, которая стоит вне неё — в футере панели. */
  formId: string
  onSubmit: (values: CreatePaymentSchemaType) => void
  disabled?: boolean
}

export default function PaymentForm({ form, formId, onSubmit, disabled }: PaymentFormProps) {
  const { data: students = [] } = useStudentForPaymentListQuery()
  const { data: paymentMethods = [] } = useActivePaymentMethodListQuery()
  const { data: memberList = [] } = useMemberListQuery()
  const { data: session } = useSessionQuery()

  const members = useMemo(
    () => memberList.map((m) => ({ id: m.userId, name: m.user.name })),
    [memberList],
  )

  // По умолчанию продавец — тот, кто вносит оплату. Подставляем ровно один раз, когда
  // список сотрудников приехал: следить за самим полем нельзя — очистка вернула бы
  // текущего пользователя обратно, и оплату без продавца завести было бы невозможно.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current) return
    const currentUserId = Number(session?.user?.id)
    if (!currentUserId || !memberList.some((m) => m.userId === currentUserId)) return

    prefilled.current = true
    if (form.getValues('managerId') == null) form.setValue('managerId', currentUserId)
  }, [memberList, session, form])

  const studentId = useWatch({ control: form.control, name: 'studentId' })
  const walletId = useWatch({ control: form.control, name: 'walletId' })
  const lessonCount = useWatch({ control: form.control, name: 'lessonCount' })
  const price = useWatch({ control: form.control, name: 'price' })

  // Подписи кошельков собирает сервер (`getWalletLabel`) — здесь остаётся только
  // выбрать нужного ученика.
  const wallets = useMemo(
    () => students.find((s) => s.id === studentId)?.wallets ?? [],
    [students, studentId],
  )

  // Кошелёк принадлежит ученику, и со сменой ученика прежний выбор становится
  // чужим — сервер такой оплате откажет («Кошелёк не принадлежит этому ученику»),
  // а в форме он до сих пор выглядел выбранным. Единственный кошелёк заодно
  // подставляем сам: у большинства учеников он один и выбирать не из чего.
  useEffect(() => {
    if (walletId != null && wallets.some((w) => w.id === walletId)) return
    const only = wallets.length === 1 ? wallets[0] : undefined
    if (only) form.setValue('walletId', only.id, { shouldValidate: false })
    else form.resetField('walletId')
  }, [wallets, walletId, form])

  // Ровно та цена занятия, которую посчитает сервер (`bidForLesson`), — целочисленным
  // делением. Показываем её здесь, чтобы опечатка в сумме или в занятиях была видна
  // до сохранения, а не в отчёте через месяц.
  const bidForLesson =
    typeof price === 'number' && typeof lessonCount === 'number' && lessonCount > 0
      ? Math.floor(price / lessonCount)
      : null

  const selectedWallet = wallets.find((w) => w.id === walletId) ?? null
  const paymentMethodId = useWatch({ control: form.control, name: 'paymentMethodId' })
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId) ?? null

  // Комиссия — не украшение: в отчёте о прибыли эквайринг считается ровно так
  // (`price * commission / 100`) и вычитается из выручки. Пусть та же цифра будет
  // видна в момент, когда метод выбирают.
  const acquiringFee =
    selectedMethod && selectedMethod.commission > 0 && typeof price === 'number'
      ? Math.round(price * (selectedMethod.commission / 100))
      : null

  return (
    <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-2">
        <Controller
          name="studentId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-student`}>Ученик</FieldLabel>
              <CustomCombobox
                items={students}
                getKey={(s) => s.id}
                getLabel={(s) => getFullName(s.firstName, s.lastName)}
                value={students.find((s) => s.id === field.value) ?? null}
                onValueChange={(s) => s && field.onChange(s.id)}
                id={`${formId}-student`}
                placeholder="Выберите ученика"
                emptyText="Нет доступных учеников"
                disabled={disabled}
                ariaInvalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="walletId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-wallet`}>Кошелёк</FieldLabel>
              <CustomCombobox
                items={wallets}
                getKey={(w) => w.id}
                getLabel={(w) => w.label}
                value={wallets.find((w) => w.id === field.value) ?? null}
                onValueChange={(w) => field.onChange(w?.id ?? undefined)}
                id={`${formId}-wallet`}
                placeholder="Выберите кошелёк"
                emptyText="У ученика нет активных кошельков"
                disabled={disabled || !studentId}
                ariaInvalid={fieldState.invalid}
                // Остаток прямо в списке: у ученика с двумя кошельками выбирают
                // как раз по нему, а не по названию группы.
                renderItem={(w) => (
                  <Item size="xs" className="p-0">
                    <ItemContent>
                      <ItemTitle className="whitespace-nowrap">{w.label}</ItemTitle>
                      <ItemDescription>{formatLessons(w.lessonsBalance)}</ItemDescription>
                    </ItemContent>
                  </Item>
                )}
              />
              {/* Остаток до и после: главный вопрос при вводе оплаты — не «сколько
                  занятий в пакете», а «сколько их станет у ученика». */}
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                selectedWallet && (
                  <FieldDescription>
                    Остаток: {formatLessons(selectedWallet.lessonsBalance)}
                    {typeof lessonCount === 'number' &&
                      lessonCount > 0 &&
                      ` → ${formatLessons(selectedWallet.lessonsBalance + lessonCount)}`}
                  </FieldDescription>
                )
              )}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="lessonCount"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-lessonCount`}>Количество занятий</FieldLabel>
              <NumberInput
                id={`${formId}-lessonCount`}
                {...field}
                value={field.value ?? ''}
                disabled={disabled}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="price"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-price`}>Сумма</FieldLabel>
              <NumberInput
                id={`${formId}-price`}
                {...field}
                value={field.value ?? ''}
                disabled={disabled}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                bidForLesson !== null && (
                  <FieldDescription>{formatCurrency(bidForLesson)} за занятие</FieldDescription>
                )
              )}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="date"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>Дата</FieldLabel>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="w-full font-normal" disabled={disabled} />
                  }
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
          name="managerId"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-manager`}>
                Менеджер
                <Hint text="Кто продал этот пакет. По умолчанию — вы; поменяйте, если оплату вносите за коллегу." />
              </FieldLabel>
              <CustomCombobox
                items={members}
                getKey={(m) => m.id}
                getLabel={(m) => m.name}
                value={members.find((m) => m.id === field.value) ?? null}
                onValueChange={(m) => field.onChange(m?.id ?? null)}
                id={`${formId}-manager`}
                placeholder="Выберите менеджера"
                emptyText="Нет сотрудников"
                disabled={disabled}
                showClear
                ariaInvalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="paymentMethodId"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-paymentMethod`}>
                Метод оплаты (необязательно)
                <Hint text="Если нужного метода нет в списке, обратитесь к владельцу для создания нового метода оплаты" />
              </FieldLabel>
              {/* Пустое значение — это `null`, а не пункт-пустышка «Неизвестно» с
                  `id: 0`: очистка живёт в самом комбобоксе, и подменять её опцией,
                  которой нет в базе, незачем. */}
              <CustomCombobox
                items={paymentMethods}
                getKey={(m) => m.id}
                getLabel={(m) => m.name}
                value={paymentMethods.find((m) => m.id === field.value) ?? null}
                onValueChange={(m) => field.onChange(m?.id ?? null)}
                id={`${formId}-paymentMethod`}
                placeholder="Не указан"
                emptyText="Нет доступных методов оплаты"
                disabled={disabled}
                showClear
                ariaInvalid={fieldState.invalid}
                renderItem={(item) => (
                  <Item size="xs" className="p-0">
                    <ItemContent>
                      <ItemTitle className="whitespace-nowrap">{item.name}</ItemTitle>
                      {item.commission > 0 && (
                        <ItemDescription>
                          <span className="tabular-nums">{item.commission} %</span>
                        </ItemDescription>
                      )}
                    </ItemContent>
                  </Item>
                )}
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                selectedMethod &&
                selectedMethod.commission > 0 && (
                  <FieldDescription>
                    Комиссия {selectedMethod.commission}%
                    {acquiringFee !== null && ` — эквайринг ${formatCurrency(acquiringFee)}`}
                  </FieldDescription>
                )
              )}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
