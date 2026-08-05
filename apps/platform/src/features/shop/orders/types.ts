import { Prisma } from '@repo/db'

export type OrderWithItemsAndStudent = Prisma.OrderGetPayload<{
  include: { student: true; items: { include: { product: true } } }
}>

/** Сумма заказа по снимку цены в позициях, а не по текущей цене товара. */
export function orderTotal(order: { items: { quantity: number; priceAtPurchase: number }[] }) {
  return order.items.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0)
}
