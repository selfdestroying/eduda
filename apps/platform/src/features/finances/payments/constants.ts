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
 * Бейдж статуса: подложка в 10% цвета, текст тем же цветом, точка слева, рамки
 * нет. Классы прописаны здесь, а не через `variant` бейджа, потому что варианты
 * `success`/`destructive` в дизайн-системе подложку сейчас не дают (см. `\10`
 * вместо `/10` в `badge.tsx`) — и точки у них тоже нет.
 *
 * Зелёный / красный / янтарный: обычная, отменённая, и корректировка бэкфилла —
 * не ошибка, но и не живые деньги, поэтому отдельным цветом, а не серым.
 */
export const PAYMENT_KIND_BADGE: Record<PaymentKind, { badge: string; dot: string }> = {
  active: {
    badge: 'border-none bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400',
    dot: 'bg-green-600 dark:bg-green-400',
  },
  cancelled: {
    badge: 'border-none bg-red-600/10 text-red-600 dark:bg-red-400/10 dark:text-red-400',
    dot: 'bg-red-600 dark:bg-red-400',
  },
  adjustment: {
    badge: 'border-none bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
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
