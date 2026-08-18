import { Prisma } from '@repo/db'

/**
 * Поля, которые рисует таблица оплат, — и ничего сверх них. `include: true` по
 * связям тянул в браузер все скаляры ученика, группы, курса и локации на каждую
 * строку; список за месяц из-за этого весил мегабайты.
 *
 * Кошелька здесь нет: его подпись перестала выводиться в строке, а держать ради
 * неё вложенную выборку `wallet → studentGroups → group → course/schedules` на
 * каждую строку — платить за то, чего никто не читает.
 */
export const PAYMENT_LIST_SELECT = {
  id: true,
  price: true,
  date: true,
  // Счёт обезличен: занятия, ученик и продавец приходят через пакеты. Их у счёта
  // может быть несколько, и в строке они складываются. Выборка узкая — на строку
  // приходится один-два пакета.
  packages: {
    select: {
      id: true,
      lessonCount: true,
      remaining: true,
      status: true,
      student: { select: { id: true, firstName: true, lastName: true } },
      manager: { select: { id: true, name: true } },
    },
  },
  status: true,
  cancelledAt: true,
  paymentMethod: { select: { id: true, name: true } },
} satisfies Prisma.PaymentSelect

/** Строка таблицы. */
export type PaymentListItem = Prisma.PaymentGetPayload<{
  select: typeof PAYMENT_LIST_SELECT
}>

/**
 * Срез плюс общее число строк по тому же `where`. `total` нужен пагинации: сама
 * она видит только текущую страницу и посчитать количество страниц не может.
 */
export type PaymentListResult = {
  rows: PaymentListItem[]
  total: number
}
