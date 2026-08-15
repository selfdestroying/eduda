'use client'

import { useMemberListQuery } from '@/src/features/organization/members/queries'
import { useSessionQuery } from '@/src/features/users/me/queries'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { dateToYmd, todayYmdInTz, ymdToLocalDate } from '@/src/lib/timezone'
import { formatCurrency, getFullName } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { CustomCombobox } from '@repo/ui/components/custom-combobox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@repo/ui/components/field'
import { Hint } from '@repo/ui/components/hint'
import { Input } from '@repo/ui/components/input'
import { NumberInput } from '@repo/ui/components/number-input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
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

/**
 * «Метод не выбран» в селекте. Значение пункта — строка, а `null` пунктом быть
 * не может, поэтому пустоту приходится называть; в форму она уходит как `null`.
 */
const NO_PAYMENT_METHOD = 'none'

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

  // Списки для `Select` мемоизируем не для скорости: `Select.Root` кладёт `items`
  // в свой стор эффектом, зависящим от ссылки на массив, — новый массив на каждый
  // рендер уводит его в бесконечное обновление («Maximum update depth exceeded»).
  const walletItems = useMemo(
    () => wallets.map((w) => ({ value: String(w.id), label: w.label })),
    [wallets],
  )
  const paymentMethodItems = useMemo(
    () => [
      { value: NO_PAYMENT_METHOD, label: 'Не указан' },
      ...paymentMethods.map((m) => ({ value: String(m.id), label: m.name })),
    ],
    [paymentMethods],
  )

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
              {/* Селект, а не комбобокс: кошельков у ученика один-три, искать
                  среди них нечего, а поле ввода предлагает печатать там, где
                  печатать нельзя. */}
              <Select
                items={walletItems}
                value={field.value != null ? String(field.value) : null}
                onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                disabled={disabled || !studentId}
              >
                <SelectTrigger
                  id={`${formId}-wallet`}
                  className="w-full"
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue
                    placeholder={studentId ? 'Выберите кошелёк' : 'Сначала выберите ученика'}
                  />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {wallets.map((w) => (
                      // Остаток прямо в списке: у ученика с двумя кошельками
                      // выбирают как раз по нему, а не по названию группы.
                      <SelectItem key={w.id} value={String(w.id)}>
                        <span className="flex-1 truncate">{w.label}</span>
                        <span className="text-muted-foreground">
                          {formatLessons(w.lessonsBalance)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
              <FieldLabel htmlFor={`${formId}-date`}>Дата</FieldLabel>
              {/* Нативное поле, а не попап с календарём: его `value` — уже
                  `YYYY-MM-DD`, то есть ровно то, что лежит в `Payment.date`,
                  преобразовывать нечего. Дату можно набрать с клавиатуры, формат
                  показа берётся из системы, а на телефоне открывается системный
                  барабан вместо нашего календаря. */}
              <Input
                id={`${formId}-date`}
                type="date"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || undefined)}
                onBlur={field.onBlur}
                disabled={disabled}
                aria-invalid={fieldState.invalid}
              />
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
              {/* Методов три-пять, их заводит владелец школы — здесь тоже нечего
                  искать. «Не указан» — обычный пункт списка: поле необязательное,
                  и выбор «никакой» должен быть виден наравне с остальными. */}
              <Select
                items={paymentMethodItems}
                value={field.value != null ? String(field.value) : NO_PAYMENT_METHOD}
                onValueChange={(v) =>
                  field.onChange(v && v !== NO_PAYMENT_METHOD ? Number(v) : null)
                }
                disabled={disabled}
              >
                <SelectTrigger
                  id={`${formId}-paymentMethod`}
                  className="w-full"
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value={NO_PAYMENT_METHOD}>
                      <span className="text-muted-foreground">Не указан</span>
                    </SelectItem>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        <span className="flex-1 truncate">{m.name}</span>
                        {m.commission > 0 && (
                          <span className="text-muted-foreground tabular-nums">
                            {m.commission} %
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
