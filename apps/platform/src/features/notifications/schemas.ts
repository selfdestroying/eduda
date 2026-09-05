import { ReminderLineSchema, ReminderTemplateSchema } from '@repo/core/reminder-template'
import { DateOnlySchema } from '@/src/lib/timezone'
import { z } from 'zod'

/**
 * Токен кабинета родителя (`Parent.accessToken`) — он же ключ доступа сюда.
 * Форма проверяется до запроса: колонка в базе типа `uuid`, и Postgres падает
 * на любой другой строке, а токен приходит из адреса.
 */
const TokenSchema = z.string().uuid()

export const CabinetMessengersSchema = z.object({
  token: TokenSchema,
})

export const DisconnectMessengerSchema = z.object({
  token: TokenSchema,
  provider: z.enum(['VK', 'MAX']),
})

export type CabinetMessengersSchemaType = z.infer<typeof CabinetMessengersSchema>
export type DisconnectMessengerSchemaType = z.infer<typeof DisconnectMessengerSchema>

// ─── Настройки школы ────────────────────────────────────────────────

/** `HH:mm` в поясе школы — тот же формат, что у `Lesson.time`. */
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ')

/**
 * За сколько до начала урока напоминать в режиме «в день занятия». Список
 * закрытый, а не диапазон: крон приходит раз в десять минут, поэтому «за 47
 * минут» всё равно превратилось бы в «примерно за 47», а интерфейсу пришлось бы
 * заводить ветку «другое» ради значения, которого никто не просил. Понадобится
 * произвольное — здесь и в форме появится по одной строке.
 */
export const REMINDER_LEAD_OPTIONS = [
  { minutes: 30, label: '30 минут' },
  { minutes: 60, label: '1 час' },
  { minutes: 120, label: '2 часа' },
  { minutes: 180, label: '3 часа' },
] as const

export const DEFAULT_LEAD_MINUTES = 120

export const ReminderSettingsSchema = z.object({
  remindersEnabled: z.boolean(),
  /**
   * Режимы устроены по-разному, а не отличаются одним числом: «накануне» — одно
   * сообщение на день в назначенный час, «в день занятия» — по сообщению на
   * время урока. Поэтому дальше два поля, и каждое значит что-то только в своём
   * режиме; второе при переключении не чистится.
   */
  reminderMode: z.enum(['DAY_BEFORE', 'SAME_DAY']),
  reminderTime: TimeSchema,
  reminderLeadMinutes: z.union([z.literal(30), z.literal(60), z.literal(120), z.literal(180)]),
  /**
   * Проверка приезжает из `@repo/core`: там же живёт рендер, и обе половины
   * обязаны знать один список подстановок. Ошибку в шаблоне видно не сразу, а
   * когда сообщение уже ушло родителям, — поэтому она на сохранении.
   */
  reminderTemplate: ReminderTemplateSchema,
  /** Рендерится на каждое занятие, поэтому подстановки у неё свои. */
  reminderLineTemplate: ReminderLineSchema,
})

export type ReminderSettingsSchemaType = z.infer<typeof ReminderSettingsSchema>

// ─── Экран школы ────────────────────────────────────────────────────

/** Общая часть выборки списка: всё приходит из адресной строки, всё с границами. */
const ListSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(10),
  // `sort.id` не сужаем до списка колонок: в чужих ссылках живут id
  // переименованных, и `z.enum` уронил бы страницу вместо порядка по умолчанию.
  sort: z.object({ id: z.string(), desc: z.boolean() }).nullish(),
  search: z.string().trim().max(100).optional(),
  providers: z.array(z.enum(['VK', 'MAX'])).default([]),
})

export const ReminderParentListSchema = ListSchema.extend({
  /** `none` — привязки нет вовсе; именно этих родителей школа и дожимает. */
  connection: z.array(z.enum(['connected', 'unsubscribed', 'none'])).default([]),
})

export const ReminderLogListSchema = ListSchema.extend({
  statuses: z.array(z.enum(['PENDING', 'SENT', 'FAILED'])).default([]),
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
})

export type ReminderParentListSchemaType = z.infer<typeof ReminderParentListSchema>
export type ReminderLogListSchemaType = z.infer<typeof ReminderLogListSchema>
