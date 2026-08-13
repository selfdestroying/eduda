import type { PaymentListItem } from './types'

/**
 * «Вид» оплаты для фильтра — то, что человек хочет отделить одно от другого, а
 * не колонка в базе: `status` и `isAdjustment` там ортогональны (корректировка
 * бэкфилла лежит со статусом ACTIVE).
 */
export const PAYMENT_KINDS = ['active', 'cancelled', 'adjustment'] as const

export type PaymentKind = (typeof PAYMENT_KINDS)[number]

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  active: 'Активная',
  cancelled: 'Отменена',
  adjustment: 'Корректировка',
}

/**
 * Вариант бейджа статуса — из дизайн-системы, а не набор классов: `success`,
 * `destructive` и `warning` дают ровно то же (подложка в 10% цвета, текст тем же
 * цветом), но одинаково со всеми бейджами приложения.
 *
 * Корректировка бэкфилла — `warning` (янтарный): не ошибка, но и не живые деньги.
 */
export const PAYMENT_KIND_BADGE: Record<PaymentKind, 'success' | 'destructive' | 'warning'> = {
  active: 'success',
  cancelled: 'destructive',
  adjustment: 'warning',
}

export const PAYMENT_KIND_OPTIONS = PAYMENT_KINDS.map((value) => ({
  value,
  label: PAYMENT_KIND_LABELS[value],
}))

export function getPaymentKind(payment: {
  status: PaymentListItem['status']
  isAdjustment: boolean
}): PaymentKind {
  if (payment.status === 'CANCELLED') return 'cancelled'
  return payment.isAdjustment ? 'adjustment' : 'active'
}
