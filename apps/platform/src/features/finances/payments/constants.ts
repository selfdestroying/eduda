import type { TableFilterItem } from '@repo/ui/components/table-filter'
import type { PaymentListItem } from './types'

/**
 * «Вид» оплаты для фильтра — то, что человек хочет отделить одно от другого, а
 * не колонка в базе: `status` и `isAdjustment` там ортогональны (корректировка
 * бэкфилла лежит со статусом ACTIVE).
 */
export const PAYMENT_KINDS = ['active', 'cancelled', 'adjustment'] as const

export type PaymentKind = (typeof PAYMENT_KINDS)[number]

export const PAYMENT_KIND_OPTIONS: TableFilterItem[] = [
  { value: 'active', label: 'Активная' },
  { value: 'cancelled', label: 'Отменена' },
  { value: 'adjustment', label: 'Корректировка' },
]

export function getPaymentKind(payment: {
  status: PaymentListItem['status']
  isAdjustment: boolean
}): PaymentKind {
  if (payment.status === 'CANCELLED') return 'cancelled'
  return payment.isAdjustment ? 'adjustment' : 'active'
}
