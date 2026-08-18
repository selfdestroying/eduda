import { Prisma } from '@repo/db'

/**
 * Поля, которые рисует таблица пакетов, — и ничего сверх них. `include: true` по
 * связям тянул в браузер все скаляры ученика, группы, курса и локации на каждую
 * строку; список за месяц из-за этого весил мегабайты.
 *
 * Метода оплаты здесь нет: он на счёте, а у пакета счёта может не быть вовсе
 * (подарок, корректировка). Кошелька тоже — его подпись в строке не выводится, а
 * ради неё пришлось бы тянуть `wallet → studentGroups → group → course/schedules`.
 */
export const PACKAGE_LIST_SELECT = {
  id: true,
  lessonCount: true,
  remaining: true,
  price: true,
  unitPrice: true,
  date: true,
  status: true,
  cancelledAt: true,
  productName: true,
  student: { select: { id: true, firstName: true, lastName: true } },
  manager: { select: { id: true, name: true } },
} satisfies Prisma.PackageSelect

/** Строка таблицы. */
export type PackageListItem = Prisma.PackageGetPayload<{
  select: typeof PACKAGE_LIST_SELECT
}>

/**
 * Срез плюс общее число строк по тому же `where`. `total` нужен пагинации: сама
 * она видит только текущую страницу и посчитать количество страниц не может.
 */
export type PackageListResult = {
  rows: PackageListItem[]
  total: number
}

/**
 * Панель под раскрытой строкой — счёт пакета. Отдельно от `PACKAGE_LIST_SELECT`:
 * счёт и продукт это два джойна, а раскрывают одну строку из десяти; тянуть их на
 * каждую строку каждой страницы незачем.
 */
export const PACKAGE_DETAILS_SELECT = {
  id: true,
  productName: true,
  product: { select: { id: true, name: true, isActive: true } },
  payment: {
    select: {
      id: true,
      price: true,
      date: true,
      status: true,
      cancelledAt: true,
      paymentMethod: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PackageSelect

export type PackageDetails = Prisma.PackageGetPayload<{
  select: typeof PACKAGE_DETAILS_SELECT
}>
