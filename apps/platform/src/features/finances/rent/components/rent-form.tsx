'use client'

import { CustomCombobox } from '@/src/components/custom-combobox'
import { NumberInput } from '@/src/components/number-input'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { Calendar } from '@/src/components/ui/calendar'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/src/components/ui/field'
import { Input } from '@/src/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { useMappedLocationListQuery } from '@/src/features/locations/queries'
import { dateToYmd, ymdToLocalDate } from '@/src/lib/timezone'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar as CalendarIcon, Info } from 'lucide-react'
import { Controller, FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form'

interface RentFormProps<T extends FieldValues> {
  form: UseFormReturn<T>
  formId: string
  /** Hide the location picker (when location is pre-selected) */
  lockLocation?: boolean
  /** Form mode - 'edit' shows a warning about preserving history */
  mode?: 'create' | 'edit'
}

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i)

export default function RentForm<T extends FieldValues>({
  form,
  formId,
  lockLocation = false,
  mode = 'create',
}: RentFormProps<T>) {
  const { data: locations = [] } = useMappedLocationListQuery()

  const isMonthly = form.watch('isMonthly' as Path<T>) as boolean

  const setMode = (monthly: boolean) => {
    form.setValue('isMonthly' as Path<T>, monthly as PathValue<T, Path<T>>, {
      shouldValidate: false,
      shouldDirty: true,
    })
    if (monthly) {
      form.setValue('startDate' as Path<T>, undefined as PathValue<T, Path<T>>)
      form.setValue('endDate' as Path<T>, undefined as PathValue<T, Path<T>>)
    } else {
      form.setValue('month' as Path<T>, undefined as PathValue<T, Path<T>>)
      form.setValue('year' as Path<T>, undefined as PathValue<T, Path<T>>)
    }
    form.clearErrors(['startDate', 'endDate', 'month', 'year'] as Path<T>[])
  }

  return (
    <form id={formId}>
      <FieldGroup>
        {mode === 'edit' && (
          <Alert variant="default">
            <Info />
            <AlertTitle>Изменилась сумма аренды?</AlertTitle>
            <AlertDescription>
              Чтобы сохранить историю платежей и корректно считать расходы за прошлые периоды,
              создайте новую запись кнопкой «Новая запись», а редактирование используйте только для
              исправления ошибок.
            </AlertDescription>
          </Alert>
        )}

        {/* Location */}
        {!lockLocation && (
          <Controller
            control={form.control}
            name={'locationId' as Path<T>}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Локация</FieldLabel>
                <CustomCombobox
                  items={locations}
                  value={
                    field.value
                      ? (locations.find((l) => l.value === String(field.value)) ?? null)
                      : null
                  }
                  onValueChange={(item) => field.onChange(item ? Number(item.value) : undefined)}
                  placeholder="Выберите локацию"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        )}

        {/* Period mode switcher */}
        <Field>
          <FieldLabel>Период аренды</FieldLabel>
          <Tabs
            value={isMonthly ? 'monthly' : 'range'}
            onValueChange={(v) => setMode(v === 'monthly')}
          >
            <TabsList className="w-full">
              <TabsTrigger value="range" className="flex-1">
                Диапазон дат
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex-1">
                Ежемесячно
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-muted-foreground text-xs">
            {isMonthly
              ? 'Сумма списывается каждый месяц начиная с указанного месяца и года.'
              : 'Разовый платёж за указанный период (дата начала - дата окончания).'}
          </p>
        </Field>

        {/* Range mode: Start + End Date */}
        {!isMonthly && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name={'startDate' as Path<T>}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Дата начала</FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      render={<Button variant="outline" className="w-full font-normal" />}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {field.value
                        ? format(ymdToLocalDate(field.value as string), 'd MMM yyyy', {
                            locale: ru,
                          })
                        : 'Выберите дату'}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? ymdToLocalDate(field.value as string) : undefined}
                        onSelect={(value) => value && field.onChange(dateToYmd(value))}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name={'endDate' as Path<T>}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Дата окончания</FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      render={<Button variant="outline" className="w-full font-normal" />}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {field.value
                        ? format(ymdToLocalDate(field.value as string), 'd MMM yyyy', {
                            locale: ru,
                          })
                        : 'Выберите дату'}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? ymdToLocalDate(field.value as string) : undefined}
                        onSelect={(value) => value && field.onChange(dateToYmd(value))}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        )}

        {/* Monthly mode: Month + Year */}
        {isMonthly && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name={'month' as Path<T>}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Месяц начала</FieldLabel>
                  <Select
                    value={
                      field.value !== undefined && field.value !== null ? String(field.value) : ''
                    }
                    onValueChange={(v) => field.onChange(v === '' ? undefined : Number(v))}
                  >
                    <SelectTrigger className="w-full" data-size="default">
                      <SelectValue placeholder="Выберите месяц">
                        {(value) =>
                          value !== null && value !== '' ? MONTHS[Number(value)] : 'Выберите месяц'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {MONTHS.map((m, idx) => (
                          <SelectItem key={idx} value={String(idx)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name={'year' as Path<T>}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Год начала</FieldLabel>
                  <Select
                    value={
                      field.value !== undefined && field.value !== null ? String(field.value) : ''
                    }
                    onValueChange={(v) => field.onChange(v === '' ? undefined : Number(v))}
                  >
                    <SelectTrigger className="w-full" data-size="default">
                      <SelectValue placeholder="Выберите год" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {YEARS.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        )}

        {/* Amount */}
        <Controller
          control={form.control}
          name={'amount' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-amount`}>
                {isMonthly ? 'Сумма в месяц (₽)' : 'Сумма (₽)'}
              </FieldLabel>
              <NumberInput
                id={`${formId}-amount`}
                placeholder="0"
                {...field}
                onChange={field.onChange}
                value={field.value ?? ''}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Comment */}
        <Controller
          control={form.control}
          name={'comment' as Path<T>}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={`${formId}-comment`}>Комментарий</FieldLabel>
              <Input
                id={`${formId}-comment`}
                placeholder="Необязательный комментарий"
                {...field}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  )
}
