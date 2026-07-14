import { endOfDay, format, startOfDay } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import { ru } from 'date-fns/locale'
import z from 'zod'

/**
 * Часовой пояс по умолчанию.
 * Используется как fallback, когда у организации не задан валидный `timezone`.
 * Бизнес-логика больше НЕ привязана к нему жёстко — реальный пояс приходит из
 * `Organization.timezone` (сервер: `ctx.tz`, клиент: `useOrgTimezone()`).
 */
export const DEFAULT_TZ = 'Europe/Moscow'

const pad = (n: number) => String(n).padStart(2, '0')

/** Регулярка date-only строки `YYYY-MM-DD`. */
export const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Zod-схема date-only поля: строка `YYYY-MM-DD` (календарный день без пояса).
 * Хранится как есть, сравнивается лексикографически = хронологически.
 */
export const DateOnlySchema = z.string().regex(YMD_REGEX, 'Некорректная дата')

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
 * Начало дня (00:00 в указанной таймзоне), возвращённое как UTC Date.
 * Использовать для запросов к БД по timestamp-полям: «начиная с сегодня по поясу орг».
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
 * formatInTz(order.createdAt, tz, 'd MMMM, EEEE', { locale: ru })
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
 * «Сегодня» в указанной таймзоне как строка `YYYY-MM-DD`.
 * Основной идиом для сравнения и записи date-only полей относительно текущего
 * дня в поясе организации (date-only колонки хранятся строками).
 *
 * @example
 * todayYmdInTz(ctx.tz) // "2026-01-15"
 */
export function todayYmdInTz(tz: string): string {
  return formatInTimeZone(new Date(), safeTz(tz), 'yyyy-MM-dd')
}

// ---------------------------------------------------------------------------
// Date-only хелперы (колонки хранятся строками `YYYY-MM-DD`).
// ---------------------------------------------------------------------------

/**
 * `Date` из браузерного date-picker → строка `YYYY-MM-DD` по локальным компонентам.
 * Гарантирует, что «15 января» в любом браузерном TZ → "2026-01-15".
 *
 * Использовать для date-only полей (Lesson.date, birthDate, startDate и т.д.),
 * которые хранятся как строка `YYYY-MM-DD`.
 *
 * @example
 * dateToYmd(new Date(2026, 0, 15)) // "2026-01-15"
 */
export function dateToYmd(browserDate: Date): string {
  return `${browserDate.getFullYear()}-${pad(browserDate.getMonth() + 1)}-${pad(browserDate.getDate())}`
}

/**
 * Date-only строка `YYYY-MM-DD` → локальный `Date` (полдень того же дня).
 * Для date-fns format() с locale — компоненты дня читаются корректно в любом поясе.
 *
 * @example
 * format(ymdToLocalDate(lesson.date), 'd MMMM, EEEE', { locale: ru }) // "15 февраля, воскресенье"
 */
export function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, 12, 0, 0)
}

/**
 * Форматировать date-only строку `YYYY-MM-DD` для отображения.
 *
 * @example
 * formatDateOnly(lesson.date) // "15.01.2026"
 * formatDateOnly(student.birthDate, { year: 'numeric', month: 'long', day: 'numeric' }) // "15 января 2026 г."
 */
export function formatDateOnly(
  ymd: string,
  options?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  return ymdToLocalDate(ymd).toLocaleDateString('ru-RU', options)
}

/**
 * Форматировать date-only строку в формате "d MMMM" (например, "15 февраля").
 *
 * @example
 * formatDate('2026-02-15') // "15 февраля"
 */
export function formatDate(ymd: string) {
  return format(ymdToLocalDate(ymd), 'd MMMM', { locale: ru })
}
