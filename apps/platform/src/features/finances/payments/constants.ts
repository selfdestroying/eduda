/**
 * Статус и «корректировка» — два независимых поля, а не одно выводимое: в базе
 * `status` и `isAdjustment` ортогональны (корректировка бэкфилла лежит со статусом
 * ACTIVE). Пока их склеивали в один «вид», по нему нельзя было ни отсортировать —
 * SQL-порядка под выдуманную подпись нет, — ни построить `where` механически.
 */
export const PAYMENT_STATUSES = ['ACTIVE', 'CANCELLED'] as const

export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatusValue, string> = {
  ACTIVE: 'Активная',
  CANCELLED: 'Отменена',
}

/** Вариант бейджа из дизайн-системы: подложка в 10% цвета плюс текст тем же цветом. */
export const PAYMENT_STATUS_BADGE: Record<PaymentStatusValue, 'success' | 'destructive'> = {
  ACTIVE: 'success',
  CANCELLED: 'destructive',
}

export const PAYMENT_STATUS_OPTIONS = PAYMENT_STATUSES.map((value) => ({
  value,
  label: PAYMENT_STATUS_LABELS[value],
}))

/**
 * `isAdjustment` в таблице не показывается и не фильтруется — по решению от
 * 13.08.2026. Значит корректировки бэкфилла в списке выглядят как обычные оплаты:
 * отделить их глазом или отбором на этой странице нельзя, только по данным.
 */
