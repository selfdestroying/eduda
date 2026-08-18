/**
 * Статусы счёта. `PENDING` — выставлен, деньги не пришли: пакеты под ним не выданы,
 * баланс не тронут. `ACTIVE` — оплачен.
 */
export const PAYMENT_STATUSES = ['PENDING', 'ACTIVE', 'CANCELLED'] as const

export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatusValue, string> = {
  PENDING: 'Ждёт оплаты',
  ACTIVE: 'Оплачена',
  CANCELLED: 'Отменена',
}

/** Вариант бейджа из дизайн-системы: подложка в 10% цвета плюс текст тем же цветом. */
export const PAYMENT_STATUS_BADGE: Record<
  PaymentStatusValue,
  'success' | 'destructive' | 'warning'
> = {
  PENDING: 'warning',
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
