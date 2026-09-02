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

export const ReminderSettingsSchema = z.object({
  remindersEnabled: z.boolean(),
  reminderTime: TimeSchema,
  /** 1 — накануне, 0 — утром в день занятия. Третьего варианта нет. */
  reminderLeadDays: z.union([z.literal(0), z.literal(1)]),
})

export type ReminderSettingsSchemaType = z.infer<typeof ReminderSettingsSchema>
