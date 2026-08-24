import { Prisma } from '@repo/db'

/**
 * Поля, которые рисует таблица заказов, — и ничего сверх них. `include: true` по
 * товару тянул в браузер картинку, описание и остаток на каждую позицию каждого
 * заказа: строке нужно только название.
 */
export const ORDER_LIST_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  student: { select: { id: true, firstName: true, lastName: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      priceAtPurchase: true,
      shopItem: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.OrderSelect

/** Строка таблицы. */
export type OrderListItem = Prisma.OrderGetPayload<{ select: typeof ORDER_LIST_SELECT }>

/**
 * Срез плюс общее число строк по тому же `where`. `total` нужен пагинации: сама
 * она видит только текущую страницу и посчитать количество страниц не может.
 */
export type OrderListResult = {
  rows: OrderListItem[]
  total: number
}

/** Сумма заказа по снимку цены в позициях, а не по текущей цене товара. */
export function orderTotal(order: { items: { quantity: number; priceAtPurchase: number }[] }) {
  return order.items.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0)
}
