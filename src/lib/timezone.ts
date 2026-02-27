import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { startOfDay, endOfDay } from 'date-fns'

/**
 * Бизнес-часовой пояс приложения.
 * Все бизнес-даты (уроки, KPI, статистика) привязаны к этой таймзоне.
 */
export const BUSINESS_TZ = 'Europe/Moscow'

/**
 * Текущий момент времени в московской таймзоне.
 * Использовать для UI-пресетов, определения «сегодня» по Москве.
 */
export function moscowNow(): Date {
  return toZonedTime(new Date(), BUSINESS_TZ)
}

/**
 * Начало московского дня (00:00 MSK), возвращённое как UTC Date.
 * Использовать для запросов к БД: "уроки начиная с сегодня по Москве".
 *
 * @param date - дата в московском времени (по умолчанию — moscowNow())
 * @returns UTC Date, соответствующий 00:00 MSK указанного дня
 *
 * @example
 * // В 01:00 UTC (04:00 MSK) 15 января:
 * moscowStartOfDay() // → 2026-01-14T21:00:00Z (00:00 MSK 15 января)
 */
export function moscowStartOfDay(date?: Date): Date {
  const moscow = date ?? moscowNow()
  const start = startOfDay(moscow)
  return fromZonedTime(start, BUSINESS_TZ)
}

/**
 * Конец московского дня (23:59:59.999 MSK), возвращённый как UTC Date.
 *
 * @param date - дата в московском времени (по умолчанию — moscowNow())
 * @returns UTC Date, соответствующий 23:59:59.999 MSK указанного дня
 */
export function moscowEndOfDay(date?: Date): Date {
  const moscow = date ?? moscowNow()
  const end = endOfDay(moscow)
  return fromZonedTime(end, BUSINESS_TZ)
}

/**
 * Конвертировать UTC дату в московское время.
 * Использовать для отображения timestamp-полей (createdAt, updatedAt).
 *
 * @example
 * toMoscow(payment.createdAt).toLocaleString('ru-RU')
 */
export function toMoscow(utcDate: Date | string): Date {
  return toZonedTime(utcDate, BUSINESS_TZ)
}

/**
 * Конвертировать московскую дату в UTC для записи в БД.
 * Использовать для timestamp-полей, когда дата интерпретируется как московская.
 *
 * @example
 * fromMoscow(selectedDate) // 15 Jan 00:00 MSK → 14 Jan 21:00 UTC
 */
export function fromMoscow(moscowDate: Date | string): Date {
  return fromZonedTime(moscowDate, BUSINESS_TZ)
}

/**
 * Форматировать UTC дату в московском времени.
 * Обёртка над formatInTimeZone с зафиксированной таймзоной.
 *
 * @example
 * formatMoscow(lesson.date, 'd MMMM, EEEE', { locale: ru })
 */
export function formatMoscow(
  date: Date | string,
  format: string,
  options?: Parameters<typeof formatInTimeZone>[3]
): string {
  return formatInTimeZone(date, BUSINESS_TZ, format, options)
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
    Date.UTC(browserDate.getFullYear(), browserDate.getMonth(), browserDate.getDate())
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
  options?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ru-RU', { timeZone: 'UTC', ...options })
}
