import { Prisma } from '@repo/db'

/** Поля, которые рисует таблица расходов, — и ничего сверх них. */
export const EXPENSE_LIST_SELECT = {
  id: true,
  name: true,
  amount: true,
  date: true,
  comment: true,
} satisfies Prisma.ExpenseSelect

/** Строка таблицы. */
export type ExpenseListItem = Prisma.ExpenseGetPayload<{ select: typeof EXPENSE_LIST_SELECT }>

/**
 * Срез, общее число строк и сумма по тому же `where`. `total` нужен пагинации, а
 * `amountTotal` — самой странице: «сколько потрачено за период» иначе считалось бы
 * по видимой странице, то есть по десяти случайным строкам.
 */
export type ExpenseListResult = {
  rows: ExpenseListItem[]
  total: number
  amountTotal: number
}
