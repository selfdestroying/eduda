import type { Prisma } from '@repo/db'

// Не импортируем список из `lessons-balance`: тот модуль помечен `server-only`,
// а этот должен оставаться проверяемым в отрыве от Next. `satisfies` держит
// имена привязанными к схеме — переименование колонки сломает сборку.
const FINANCIAL_KEYS = new Set<string>([
  'lessonsBalance',
  'totalPayments',
  'totalLessons',
] as const satisfies readonly (keyof Prisma.StudentUncheckedUpdateInput)[])

/**
 * Правка ли это анкеты (а значит, двигает ли дату актуальности).
 *
 * `updateStudent` в админке — общий passthrough: через него летят и ФИО, и
 * баланс. Баланс и оплаты меняются сами по себе — если бы они двигали дату, у
 * любого платящего ученика данные всегда выглядели бы свежими, и вся отметка
 * потеряла бы смысл. Поэтому дату двигает только всё остальное.
 */
export function isProfileEdit(data: object | undefined): boolean {
  if (!data) return false
  return Object.keys(data).some((key) => !FINANCIAL_KEYS.has(key) && key !== 'dataActualizedAt')
}

/**
 * Отметить, что анкетные данные ученика изменились.
 *
 * Кнопки «подтвердить актуальность» больше нет: актуальность — это дата
 * последней правки, а не отдельный флаг. Поэтому дату двигает любое изменение
 * ФИО, даты рождения или контактов родителей — хоть из кабинета родителя, хоть
 * из админки. Финансовые поля (баланс, оплаты) сюда НЕ относятся: они меняются
 * сами по себе и ничего не говорят о свежести анкеты.
 *
 * Колонка называется `dataActualizedAt` по историческим причинам — переименовать
 * её значило бы миграцию, а смысл теперь «когда данные последний раз меняли».
 */
export function touchStudentData(tx: Prisma.TransactionClient, studentIds: number[]) {
  if (studentIds.length === 0) return Promise.resolve({ count: 0 })

  return tx.student.updateMany({
    where: { id: { in: studentIds } },
    data: { dataActualizedAt: new Date() },
  })
}
