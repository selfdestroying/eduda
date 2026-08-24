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
  price: true,
  date: true,
  // Не колонка: по статусу таблица приглушает отменённую строку.
  status: true,
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
