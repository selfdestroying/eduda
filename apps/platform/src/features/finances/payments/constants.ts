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
 * Вид бейджа в колонке «Статус». Обычная оплата — `secondary`: таких строк
 * большинство, и красить их во что-то заметное значит закрасить всю таблицу.
 */
export const PAYMENT_KIND_BADGE: Record<PaymentKind, 'secondary' | 'destructive' | 'outline'> = {
  active: 'secondary',
  cancelled: 'destructive',
  adjustment: 'outline',
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
