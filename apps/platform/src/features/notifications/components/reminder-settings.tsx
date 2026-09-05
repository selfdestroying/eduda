'use client'

import { useSessionQuery } from '@/src/features/users/me/queries'
import { cn } from '@/src/lib/utils'
import {
  LINE_PLACEHOLDERS,
  renderTemplate,
  TEMPLATE_PLACEHOLDERS,
  type PlaceholderSpec,
} from '@repo/core/reminder-template'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@repo/ui/components/field'
import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
import { Bubble, BubbleContent } from '@repo/ui/components/bubble'
import { Input } from '@repo/ui/components/input'
import { Logo } from '@repo/ui/components/logo'
import { Message, MessageAvatar, MessageContent, MessageHeader } from '@repo/ui/components/message'
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/radio-group'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Switch } from '@repo/ui/components/switch'
import { Textarea } from '@repo/ui/components/textarea'
import { ToggleGroup, ToggleGroupItem } from '@repo/ui/components/toggle-group'
import { Loader, Plus } from 'lucide-react'
import { useRef } from 'react'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { useReminderSettingsQuery, useUpdateReminderSettingsMutation } from '../queries'
import BotLinks from './bot-links'
import {
  REMINDER_LEAD_OPTIONS,
  ReminderSettingsSchema,
  type ReminderSettingsSchemaType,
} from '../schemas'

/**
 * Настройки ботов школы: ссылки на самих ботов в шапке и расписание рассылки.
 * Рассылает её бот из `apps/bots`; здесь только четыре поля, которыми школа
 * решает, включено ли это и когда приходит.
 *
 * Режим выбирается карточками, а его настройка живёт внутри карточки: «за день
 * до занятия» и «в день занятия» — не два значения одного числа, а два разных
 * поведения (одно сообщение на день против сообщения на каждое время урока), и
 * настройка у каждого своя. Раньше оба поля стояли в общем ряду и читались как
 * независимые.
 */
export default function ReminderSettings() {
  const { data, isPending, isError } = useReminderSettingsQuery()

  if (isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (isError || !data) {
    return (
      <p className="text-muted-foreground text-sm">
        Не удалось загрузить настройки. Обновите страницу.
      </p>
    )
  }

  return <SettingsForm settings={data} />
}

/** Образец для превью: два ребёнка, чтобы был виден и список, и его порядок. */
const SAMPLE_ROWS = [
  { ученик: 'Аня Иванова', курс: 'Программирование', время: '17:00', место: 'Центр' },
  { ученик: 'Миша Иванов', курс: 'Робототехника', время: '18:30', место: 'Центр' },
]

/**
 * Вставка подстановки в позицию курсора, а не в конец: её место в тексте — это и
 * есть то, что школа настраивает.
 */
function insertAt(
  element: HTMLTextAreaElement | HTMLInputElement | null,
  value: string,
  token: string,
  onChange: (next: string) => void,
) {
  const start = element?.selectionStart ?? value.length
  const end = element?.selectionEnd ?? value.length

  onChange(value.slice(0, start) + token + value.slice(end))

  // Курсор после вставки: без этого он прыгает в конец, и вторую подстановку
  // рядом с первой уже не поставить.
  const caret = start + token.length
  requestAnimationFrame(() => {
    element?.focus()
    element?.setSelectionRange(caret, caret)
  })
}

function PlaceholderChips({
  placeholders,
  onInsert,
}: {
  placeholders: readonly PlaceholderSpec[]
  onInsert: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {placeholders.map((placeholder) => (
        <Button
          key={placeholder.key}
          type="button"
          variant="outline"
          title={placeholder.hint}
          onClick={() => onInsert(placeholder.key)}
        >
          <Plus />
          {placeholder.label}
        </Button>
      ))}
    </div>
  )
}

/**
 * Шаблоны сообщения: тело письма и строка занятия.
 *
 * Их два, потому что сообщение одно, а занятий в нём бывает несколько — у
 * родителя двое детей или у ребёнка два урока в день. Имя ученика, курс и время
 * принадлежат строке и повторяются на каждое занятие; дата и название школы —
 * телу и рендерятся один раз.
 *
 * Превью считает `renderTemplate` — та же функция, которой планировщик собирает
 * настоящее сообщение. Своя копия «примерно так это выглядит» разошлась бы с
 * реальностью молча, а увидеть расхождение можно было бы только в журнале, после
 * отправки родителям.
 */
function TemplateField({
  form,
  isDayBefore,
}: {
  form: UseFormReturn<ReminderSettingsSchemaType>
  isDayBefore: boolean
}) {
  const { data: session } = useSessionQuery()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const lineRef = useRef<HTMLTextAreaElement>(null)

  const body = form.watch('reminderTemplate')
  const line = form.watch('reminderLineTemplate')

  const preview = renderTemplate(body, {
    занятия: SAMPLE_ROWS.map((row) => renderTemplate(line, row)).join('\n'),
    когда: isDayBefore ? 'Завтра, 5 сентября' : 'Сегодня, 5 сентября',
    дата: '5 сентября',
    школа: session?.organization?.name ?? '',
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Controller
          control={form.control}
          name="reminderTemplate"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="reminder-template">Текст сообщения</FieldLabel>
              <PlaceholderChips
                placeholders={TEMPLATE_PLACEHOLDERS}
                onInsert={(key) =>
                  insertAt(bodyRef.current, field.value, `{${key}}`, field.onChange)
                }
              />
              <Textarea
                id="reminder-template"
                rows={8}
                className="font-mono"
                ref={bodyRef}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
              <FieldDescription>
                Текст уходит родителю как есть. Команда «/stop» отключает напоминания в любом
                случае, даже если не упоминать её в сообщении.
              </FieldDescription>
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="reminderLineTemplate"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="reminder-line">Строка занятия</FieldLabel>
              <PlaceholderChips
                placeholders={LINE_PLACEHOLDERS}
                onInsert={(key) =>
                  insertAt(lineRef.current, field.value, `{${key}}`, field.onChange)
                }
              />
              <Textarea
                id="reminder-line"
                rows={2}
                className="font-mono"
                ref={lineRef}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
              <FieldDescription>
                Встаёт на место {'{занятия}'} — по строке на каждое занятие в сообщении.
              </FieldDescription>
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
      </div>

      {/* Превью не прячется на ошибке: рядом с полем оно и показывает, во что
          превратилась опечатка — незнакомая подстановка остаётся в тексте
          видимой, а не пропадает. */}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium">Что получит родитель</p>
        <Message>
          {/* Отправитель у обоих ботов один — ЕДУДА, и аватарка та же: родитель
              видит в чате именно её, а не название школы. */}
          <MessageAvatar>
            <Avatar>
              {/* Фон именно белый, а не `bg-background`: аватарка бота в
                  мессенджере одна и та же, а тема дашборда к ней отношения не
                  имеет. */}
              <AvatarFallback className="text-primary bg-white" aria-label="ЕДУДА">
                <Logo className="size-8" />
              </AvatarFallback>
            </Avatar>
          </MessageAvatar>
          <MessageContent>
            <MessageHeader>ЕДУДА</MessageHeader>
            <Bubble variant="muted">
              <BubbleContent className="text-sm whitespace-pre-line">{preview}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      </div>
    </div>
  )
}

function SettingsForm({ settings }: { settings: ReminderSettingsSchemaType }) {
  const mutation = useUpdateReminderSettingsMutation()

  const form = useForm<ReminderSettingsSchemaType>({
    resolver: zodResolver(ReminderSettingsSchema),
    defaultValues: settings,
    // По умолчанию форма проверяется только на отправке, и ошибка шаблона
    // всплывала после «Сохранить» — при том, что превью рядом уже показывает
    // последствия опечатки. Здесь ошибка нужна тогда же, когда и превью.
    mode: 'onChange',
  })

  const enabled = form.watch('remindersEnabled')
  const isDayBefore = form.watch('reminderMode') === 'DAY_BEFORE'

  /**
   * После записи форма встаёт на сохранённое, иначе `isDirty` продолжает
   * сравнивать с состоянием на момент открытия страницы: включил, сохранил,
   * выключил — и «Сохранить» гаснет, потому что стало «как было», хотя на
   * сервере лежит уже другое.
   */
  const submit = form.handleSubmit((values) =>
    mutation.mutate(values, { onSuccess: (saved) => form.reset(saved ?? values) }),
  )

  return (
    <form onSubmit={submit}>
      <Card>
        {/* На узком экране шапка — колонка: сетка `CardHeader` отдаёт кнопкам
            колонку по содержимому, и на телефоне заголовку с описанием
            оставалось около сотни пикселей, то есть по слову в строке. */}
        <CardHeader className="flex flex-col gap-2 sm:grid sm:gap-1">
          <CardTitle>Настройка ботов</CardTitle>
          <CardDescription>
            Бот пишет родителю перед занятием ребёнка. Подключается родитель сам — ссылка есть в его
            личном кабинете.
          </CardDescription>
          <CardAction>
            <BotLinks />
          </CardAction>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <Controller
              control={form.control}
              name="remindersEnabled"
              render={({ field }) => (
                <FieldLabel htmlFor="reminders-enabled">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Присылать напоминания</FieldTitle>
                      <FieldDescription>
                        {field.value ? 'Рассылка идёт' : 'Подключённые родители ничего не получают'}
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="reminders-enabled"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </Field>
                </FieldLabel>
              )}
            />

            {/* Выключено — настройки не показываем вовсе: приглушённые поля,
                которые ни на что не влияют, это шум, а не подсказка. */}
            {!enabled ? (
              <p className="text-muted-foreground text-sm">
                Включите, чтобы выбрать, когда уходит напоминание.
              </p>
            ) : (
              <>
                <Controller
                  control={form.control}
                  name="reminderMode"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Когда отправлять</FieldLabel>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="gap-2 sm:grid-cols-2"
                      >
                        {/* Ветка настройки видна у обеих карточек всегда, а у
                            невыбранной выключена: показывать её только у
                            выбранной значит менять высоту ряда на каждом
                            переключении. Выключенные контролы не ловят
                            указатель, поэтому клик по ним попадает в `label` и
                            выбирает режим — то есть включает то, на что нажали. */}
                        <label className="has-data-checked:border-primary flex cursor-pointer flex-col gap-1.5 rounded-lg border p-2.5 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <RadioGroupItem value="DAY_BEFORE" />
                            <span className="text-sm font-medium">За день до занятия</span>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            Одно сообщение вечером накануне — со всеми завтрашними занятиями сразу.
                          </p>
                          <Controller
                            control={form.control}
                            name="reminderTime"
                            render={({ field: timeField, fieldState: timeState }) => (
                              <Field className="mt-auto border-t pt-2.5">
                                <FieldLabel
                                  htmlFor="reminder-time"
                                  className={cn(!isDayBefore && 'text-muted-foreground')}
                                >
                                  Время отправки
                                </FieldLabel>
                                <Input
                                  id="reminder-time"
                                  type="time"
                                  // Секунды в поле не нужны, а без шага
                                  // браузер их иногда показывает: в базе
                                  // лежит `HH:mm`, и схема их не примет.
                                  step={60}
                                  className="w-28"
                                  disabled={!isDayBefore}
                                  {...timeField}
                                />
                                {timeState.error && (
                                  <FieldError>{timeState.error.message}</FieldError>
                                )}
                              </Field>
                            )}
                          />
                        </label>

                        <label className="has-data-checked:border-primary flex cursor-pointer flex-col gap-1.5 rounded-lg border p-2.5 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <RadioGroupItem value="SAME_DAY" />
                            <span className="text-sm font-medium">В день занятия</span>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            Отдельное сообщение перед каждым занятием — пока ещё можно собраться.
                          </p>
                          <Controller
                            control={form.control}
                            name="reminderLeadMinutes"
                            render={({ field: leadField }) => (
                              <Field className="mt-auto border-t pt-2.5">
                                <FieldLabel className={cn(isDayBefore && 'text-muted-foreground')}>
                                  За сколько до начала
                                </FieldLabel>
                                <ToggleGroup
                                  variant="outline"
                                  spacing={2}
                                  multiple={false}
                                  disabled={isDayBefore}
                                  value={[String(leadField.value)]}
                                  onValueChange={(value) =>
                                    value[0] && leadField.onChange(Number(value[0]))
                                  }
                                  className="flex-wrap"
                                >
                                  {REMINDER_LEAD_OPTIONS.map((option) => (
                                    <ToggleGroupItem
                                      key={option.minutes}
                                      value={String(option.minutes)}
                                      pressed={leadField.value === option.minutes}
                                    >
                                      {option.label}
                                    </ToggleGroupItem>
                                  ))}
                                </ToggleGroup>
                              </Field>
                            )}
                          />
                        </label>
                      </RadioGroup>
                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                  )}
                />

                <TemplateField form={form} isDayBefore={isDayBefore} />
              </>
            )}
          </FieldGroup>
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
            {mutation.isPending && <Loader className="animate-spin" />}
            Сохранить
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
