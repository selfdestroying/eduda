/**
 * Локальная копия трёх хелперов из `apps/platform/src/lib/timezone.ts` (A3 SPEC).
 * Общий `@repo/lib` заводить рано — второй потребитель появился только что.
 *
 * Отличие от оригинала: вместо `formatInTz` (date-fns-tz) здесь
 * `formatDateTimeInTz` на нативном `Intl` — в кабинете нужен только показ
 * таймстампа в поясе школы, ради него тянуть date-fns незачем.
 */

/**
 * Date-only строка `YYYY-MM-DD` → локальный `Date` (полдень того же дня),
 * чтобы компоненты дня читались одинаково в любом поясе браузера.
 */
function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, 12, 0, 0)
}

/** `formatDateOnly('2026-01-15')` → «15.01.2026» */
export function formatDateOnly(
  ymd: string,
  options?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  return ymdToLocalDate(ymd).toLocaleDateString('ru-RU', options)
}

/** `formatDateTimeInTz(order.createdAt, tz)` → «15.01.2026, 14:30» */
export function formatDateTimeInTz(
  date: Date | string,
  tz: string,
  options?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return d.toLocaleString('ru-RU', { timeZone: tz, ...options })
  } catch {
    // Битая зона в БД не должна ронять страницу — показываем в поясе сервера.
    return d.toLocaleString('ru-RU', options)
  }
}
