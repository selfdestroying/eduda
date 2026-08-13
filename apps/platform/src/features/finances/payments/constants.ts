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
 * Корректировка — это не оплата: пакеты, которыми разовый бэкфилл 08.08.2026 свёл
 * остатки кошельков с их балансом. Денег за такой записью нет, поэтому её отделяют
 * от поступлений. Значения строковые, потому что уезжают в URL.
 */
export const ADJUSTMENT_OPTIONS = [
  { value: 'false', label: 'Оплата' },
  { value: 'true', label: 'Корректировка' },
]
