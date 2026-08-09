import type { Prisma } from '@repo/db'
import { AttendanceStatus } from '@repo/db/enums'

/**
 * Списывается ли урок с баланса при таком статусе.
 * - PRESENT — всегда списывается
 * - ABSENT без предупреждения — списывается
 * - ABSENT с предупреждением, UNSPECIFIED — нет
 *
 * Живёт рядом с раздачей пакетов: это одно правило — «случилась ли проводка».
 */
export function isLessonCharged(status: AttendanceStatus, isWarned: boolean): boolean {
  if (status === AttendanceStatus.PRESENT) return true
  if (status === AttendanceStatus.ABSENT && !isWarned) return true
  return false
}

/** Поля проводки, которые уезжают в `attendance.update`. */
export type AttendanceEntry = { paymentId?: number | null; price?: number; amount?: number }

/**
 * Результат проводки: что записать в строку посещаемости и на сколько подвинуть
 * баланс кошелька. Обычно `balanceDelta` совпадает с `delta`, но при откате списания
 * с отменённой оплаты он ноль — урок туда не возвращается, значит и на баланс не
 * попадает: деньги за ту оплату школа уже вернула.
 */
export type PacketResult = { entry: AttendanceEntry; balanceDelta: number }

/**
 * Проводит посещение по очереди пакетов кошелька.
 *
 * Пакет — это `Payment` с непотраченным остатком; очередь упорядочена по дате оплаты.
 * Списание гасит головной пакет и забирает его цену урока в строку посещаемости —
 * дальше эта цена не пересчитывается, поэтому новые оплаты не двигают прошлые месяцы.
 * Откат возвращает уроки в тот пакет, из которого они ушли, а не в текущую голову:
 * при нескольких пакетах разной цены иначе поедут и остатки, и признанная выручка.
 *
 * Живёт отдельно от экшена, чтобы `scripts/check-payment-packets.ts` мог прогнать
 * денежную логику против настоящей БД, не поднимая сессию.
 */
export async function applyPacketEntryTx(
  tx: Prisma.TransactionClient,
  args: {
    /** Кошелёк списания. null — списывать не с чего: группа осталась без кошелька. */
    walletId: number | null
    /** Изменение баланса уроков: <0 — списываем, >0 — откатываем списание. */
    delta: number
    /** Проводка, записанная на строке до этого изменения. */
    previous: { paymentId: number | null; amount: number | null }
  },
): Promise<PacketResult> {
  const { walletId, delta, previous } = args

  // delta = ±1 по построению (статус либо стал платным, либо перестал), поэтому
  // визит всегда укладывается в один пакет и делить его между двумя не приходится.
  const amount = Math.abs(delta)

  if (delta > 0) {
    // Урок возвращается в свой пакет — если он у строки есть и оплата не отменена.
    // Количество обнуляем в любом случае: иначе выручка останется признанной за
    // занятие, которое больше не списано.
    const returned = await releasePacketEntryTx(tx, previous)
    const hadPacket = Boolean(previous.paymentId && previous.amount)
    return { entry: { amount: 0 }, balanceDelta: hadPacket && !returned ? 0 : delta }
  }

  // Кошелька у группы нет — списания не было, значит и выручки нет. Проводку всё
  // равно перезаписываем: иначе на строке осталась бы цена от прошлого статуса.
  if (!walletId) return { entry: { paymentId: null, price: 0, amount: 0 }, balanceDelta: 0 }

  const packet = await tx.payment.findFirst({
    where: { walletId, status: 'ACTIVE', remaining: { gt: 0 } },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: { id: true, price: true, lessonCount: true },
  })

  // Очередь пуста: школа урок провела, а оплаты под него нет. Выручку всё равно
  // признаём — по последней известной цене кошелька, тем же правилом, что и бэкфилл
  // истории. Иначе цифры разъехались бы ровно по дате внедрения: старые такие визиты
  // с ценой, новые с нулём.
  if (!packet) {
    return {
      entry: { paymentId: null, price: await walletUnitPrice(tx, walletId), amount },
      balanceDelta: delta,
    }
  }

  await tx.payment.update({
    where: { id: packet.id },
    data: { remaining: { decrement: amount } },
  })

  return {
    entry: { paymentId: packet.id, price: unitPrice(packet), amount },
    balanceDelta: delta,
  }
}

const unitPrice = (p: { price: number; lessonCount: number }) =>
  p.lessonCount > 0 ? Math.floor(p.price / p.lessonCount) : 0

/**
 * Цена урока кошелька, когда непотраченных пакетов не осталось: цена самого позднего
 * его пакета, а если оплат не было вовсе — из счётчиков, которые остались от переезда
 * на кошельки. Ноль означает, что про этот кошелёк не известно вообще ничего.
 */
async function walletUnitPrice(tx: Prisma.TransactionClient, walletId: number): Promise<number> {
  const latest = await tx.payment.findFirst({
    where: { walletId, status: 'ACTIVE' },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    select: { price: true, lessonCount: true },
  })
  if (latest) return unitPrice(latest)

  const wallet = await tx.wallet.findUnique({
    where: { id: walletId },
    select: { totalPayments: true, totalLessons: true },
  })
  if (!wallet || wallet.totalLessons <= 0) return 0
  return Math.floor(wallet.totalPayments / wallet.totalLessons)
}

/**
 * Возвращает уроки в тот пакет, из которого они ушли. Баланс кошелька при этом не
 * трогает: вызывается из отката статуса, где баланс двигает сам экшен.
 *
 * Возвращает `true`, если возврат состоялся. В отменённую оплату уроки не кладём:
 * деньги за неё школа вернула, списать с такого пакета уже нельзя, и остаток на нём
 * был бы мёртвым — он не попадает ни в очередь, ни в сверку.
 */
export async function releasePacketEntryTx(
  tx: Prisma.TransactionClient,
  entry: { paymentId: number | null; amount: number | null },
): Promise<boolean> {
  if (!entry.paymentId || !entry.amount) return false

  const updated = await tx.payment.updateMany({
    where: { id: entry.paymentId, status: 'ACTIVE' },
    data: { remaining: { increment: entry.amount } },
  })
  return updated.count > 0
}

/**
 * Полный возврат списания: урок уходит обратно и в пакет, и на баланс кошелька.
 * Нужен там, где строка посещаемости исчезает целиком — удаление записи, перенос
 * отработки, снятие отработки из кабинета родителя. Кошелёк берётся у самого пакета,
 * поэтому вызывающему не надо его резолвить заново.
 *
 * Если оплата отменена, не делает ничего: возвращать урок некуда и не за что.
 */
export async function refundAttendanceTx(
  tx: Prisma.TransactionClient,
  entry: { paymentId: number | null; amount: number | null },
): Promise<void> {
  if (!(await releasePacketEntryTx(tx, entry))) return

  const packet = await tx.payment.findUniqueOrThrow({
    where: { id: entry.paymentId! },
    select: { walletId: true },
  })
  if (!packet.walletId) return

  await tx.wallet.update({
    where: { id: packet.walletId },
    data: { lessonsBalance: { increment: entry.amount! } },
  })
}
