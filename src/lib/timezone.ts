import { endOfDay, format, startOfDay } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import { ru } from 'date-fns/locale'
import z from 'zod'

/**
 * Часовой пояс по умолчанию.
 * Используется как fallback, когда у организации не задан валидный `timezone`
 * (был `BUSINESS_TZ`). Бизнес-логика больше НЕ привязана к нему жёстко —
 * реальный пояс приходит из `Organization.timezone` (сервер: `ctx.tz`,
 * клиент: `useOrgTimezone()`).
 */
export const DEFAULT_TZ = 'Europe/Moscow'

export const DateOnlySchema = z.date().transform(normalizeDateOnly)

const validTimeZoneCache = new Map<string, boolean>()

/**
 * Проверяет, что строка — валидная IANA-таймзона.
 * Результат кешируется: конструктор `Intl.DateTimeFormat` относительно дорог,
 * а поясов в системе немного.
 */
export function isValidTimeZone(tz: string): boolean {
  const cached = validTimeZoneCache.get(tz)
  if (cached !== undefined) return cached
  let valid = false
  try {
    // Бросит RangeError на неизвестной зоне.
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    valid = true
  } catch {
    valid = false
  }
  validTimeZoneCache.set(tz, valid)
  return valid
}

/**
 * Возвращает переданную таймзону, если она валидна, иначе `DEFAULT_TZ`.
 * Все хелперы ниже прогоняют вход через это — битая строка в БД
 * (пока пояс правится вручную) не должна ронять форматирование.
 */
function safeTz(tz: string): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_TZ
}

/**
 * Человекочитаемая метка пояса с живым UTC-смещением, напр. «Europe/Moscow, UTC+3».
 */
export function formatTimeZoneLabel(tz: string): string {
  const zone = safeTz(tz)
  const offset = new Intl.DateTimeFormat('ru-RU', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value
  return offset ? `${zone}, ${offset.replace('GMT', 'UTC')}` : zone
}

/**
 * Текущий момент в указанной таймзоне как «сдвинутый» Date, локальные
 * поля которого (`getHours()`, `getDate()`, …) читаются как стеночасы зоны.
 * Использовать для UI-пресетов и определения «сегодня» по поясу организации.
 */
export function nowInTz(tz: string): Date {
  return toZonedTime(new Date(), safeTz(tz))
}

/**
 * «Сегодня» в указанной таймзоне как UTC-полночь (совместимо с `@db.Date`).
 * Самый частый идиом: сравнение и запись date-only полей относительно
 * текущего дня в поясе организации.
 */
export function todayInTz(tz: string): Date {
  return normalizeDateOnly(nowInTz(tz))
}

/**
 * Начало дня (00:00 в указанной таймзоне), возвращённое как UTC Date.
 * Использовать для запросов к БД: «начиная с сегодняшнего дня по поясу орг».
 *
 * @param tz - IANA-таймзона организации
 * @param date - дата в стеночасах этой зоны (по умолчанию — nowInTz(tz))
 */
export function startOfDayInTz(tz: string, date?: Date): Date {
  const zone = safeTz(tz)
  const zoned = date ?? toZonedTime(new Date(), zone)
  return fromZonedTime(startOfDay(zoned), zone)
}

/**
 * Конец дня (23:59:59.999 в указанной таймзоне), возвращённый как UTC Date.
 *
 * @param tz - IANA-таймзона организации
 * @param date - дата в стеночасах этой зоны (по умолчанию — nowInTz(tz))
 */
export function endOfDayInTz(tz: string, date?: Date): Date {
  const zone = safeTz(tz)
  const zoned = date ?? toZonedTime(new Date(), zone)
  return fromZonedTime(endOfDay(zoned), zone)
}

/**
 * Конвертировать UTC-дату в стеночасы указанной таймзоны.
 * Использовать для отображения timestamp-полей (createdAt, updatedAt).
 *
 * @example
 * toTz(payment.createdAt, tz)
 */
export function toTz(date: Date | string, tz: string): Date {
  return toZonedTime(date, safeTz(tz))
}

/**
 * Интерпретировать стеночасы указанной таймзоны как UTC-момент для записи в БД.
 *
 * @example
 * fromTz(selectedDate, tz) // 15 Jan 00:00 (зона) → соответствующий UTC
 */
export function fromTz(date: Date | string, tz: string): Date {
  return fromZonedTime(date, safeTz(tz))
}

/**
 * Форматировать UTC-дату в указанной таймзоне через date-fns.
 * Обёртка над `formatInTimeZone`.
 *
 * @example
 * formatInTz(lesson.date, tz, 'd MMMM, EEEE', { locale: ru })
 */
export function formatInTz(
  date: Date | string,
  tz: string,
  fmt: string,
  options?: Parameters<typeof formatInTimeZone>[3],
): string {
  return formatInTimeZone(date, safeTz(tz), fmt, options)
}

/**
 * Форматировать UTC-таймстамп (createdAt и т.п.) в локальном виде указанной
 * таймзоны через `toLocaleString('ru-RU', { timeZone })`.
 * Заменяет хак `toTz(x, tz).toLocaleString()` (двойной сдвиг).
 *
 * @example
 * formatDateTimeInTz(order.createdAt, tz) // "15.01.2026, 14:30"
 */
export function formatDateTimeInTz(
  date: Date | string,
  tz: string,
  options?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('ru-RU', { timeZone: safeTz(tz), ...options })
}

/**
 * Нормализовать Date из браузера для date-only полей (@db.Date).
 * Извлекает год/месяц/день из локального Date и создаёт UTC midnight.
 * Гарантирует что "15 января" в любом браузерном TZ → 2026-01-15T00:00:00Z.
 *
 * Использовать ТОЛЬКО для полей с @db.Date (Lesson.date, birthDate, startDate и т.д.)
 *
 * @example
 * // Браузер в Токио (UTC+9): пользователь выбрал 15 января
 * // new Date(2026, 0, 15) → 2026-01-14T15:00:00Z (НЕПРАВИЛЬНО)
 * // normalizeDateOnly(new Date(2026, 0, 15)) → 2026-01-15T00:00:00Z (ПРАВИЛЬНО)
 */
export function normalizeDateOnly(browserDate: Date): Date {
  return new Date(
    Date.UTC(browserDate.getFullYear(), browserDate.getMonth(), browserDate.getDate()),
  )
}

/**
 * Преобразовать @db.Date (UTC midnight) в локальный Date для использования
 * с date-fns format() и locale. Создаёт local noon того же дня, чтобы
 * format() показывал правильную дату в любом часовом поясе браузера.
 *
 * Использовать когда нужен date-fns format() с locale (например 'd MMMM, EEEE').
 * Для простого отображения без locale предпочтительнее formatDateOnly().
 *
 * @example
 * // lesson.date = 2026-02-15T00:00:00Z (@db.Date)
 * format(dateOnlyToLocal(lesson.date), 'd MMMM, EEEE', { locale: ru }) // "15 февраля, воскресенье"
 */
export function dateOnlyToLocal(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)
}

/**
 * Форматировать date-only значение из БД (@db.Date) для отображения.
 * Использует timeZone: 'UTC' чтобы гарантировать правильный день
 * независимо от таймзоны браузера.
 *
 * @example
 * formatDateOnly(lesson.date) // "15.01.2026"
 * formatDateOnly(student.birthDate, { year: 'numeric', month: 'long', day: 'numeric' }) // "15 января 2026 г."
 */
export function formatDateOnly(
  date: Date | string,
  options?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ru-RU', { timeZone: 'UTC', ...options })
}

/**
 * Форматировать дату для отображения в формате "d MMMM" (например, "15 февраля").
 *
 * @example
 * formatDate(new Date()) // "15 февраля"
 */
export function formatDate(date: Date) {
  return format(dateOnlyToLocal(date), 'd MMMM', { locale: ru })
}
