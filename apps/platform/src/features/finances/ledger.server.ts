import type { Prisma } from '@repo/db'
import {
  AttendanceStatus,
  StudentFinancialField,
  StudentLessonsBalanceChangeReason,
  WalletEntryKind,
} from '@repo/db/enums'

/**
 * Денежное ядро: единственное место, где посещение превращается в деньги.
 *
 * Наружу торчат ровно две операции — «занятие оплачено» и «занятие больше не
 * оплачено». Каждая делает всё, что за этим стоит: гасит или возвращает урок в
 * пакет, двигает баланс кошелька, переписывает проводку на строке, пишет строку
 * в журнал и в историю. Вызывающему не остаётся ни одной обязанности, про
 * которую можно забыть.
 *
 * Журнал (`WalletEntry`) — источник правды: остаток кошелька и остаток пакета
 * это суммы его строк, а сами колонки — кеш поверх него. Строки журнала не
 * правятся: откат списания пишет встречную строку, а не стирает старую.
 *
 * `StudentLessonsBalanceHistory` пишется рядом и по остатку уроков журнал
 * дублирует: на ней держится экран истории в карточке ученика. Когда экран
 * переедет на журнал, писать историю по `LESSONS_BALANCE` станет незачем.
 *
 * Живёт отдельно от экшенов, чтобы `scripts/check-ledger-core.ts` мог прогнать
 * денежную логику против настоящей БД, не поднимая сессию. По той же причине
 * здесь нет `server-only` и импортов из `@/src/lib`.
 */

/**
 * Списывается ли урок при таком статусе.
 * - PRESENT — всегда списывается
 * - ABSENT без предупреждения — списывается
 * - ABSENT с предупреждением, UNSPECIFIED — нет
 */
export function isLessonCharged(status: AttendanceStatus, isWarned: boolean): boolean {
  if (status === AttendanceStatus.PRESENT) return true
  if (status === AttendanceStatus.ABSENT && !isWarned) return true
  return false
}

/** Что нужно знать о строке посещаемости, чтобы провести по ней деньги. */
const moneySelect = {
  id: true,
  studentId: true,
  organizationId: true,
  walletId: true,
  paymentId: true,
  amount: true,
  price: true,
  status: true,
  lessonId: true,
  makeupForAttendanceId: true,
  lesson: { select: { groupId: true, date: true } },
  makeupForAttendance: { select: { lesson: { select: { groupId: true } } } },
} satisfies Prisma.AttendanceSelect

type MoneyAttendance = Prisma.AttendanceGetPayload<{ select: typeof moneySelect }>

export type AttendanceMoneyArgs = {
  attendanceId: number
  /** Школа вызывающего: изоляция здесь, а не у каждого из шести вызовов. */
  organizationId: number
  /** Кто инициировал. null — родитель из публичного кабинета. */
  actorUserId: number | null
  /** Дополнительные поля в историю: старый статус, название занятия и т.п. */
  meta?: Record<string, unknown>
}

/** Строка посещаемости своей школы — или ничего. */
const findAttendanceTx = (tx: Prisma.TransactionClient, args: AttendanceMoneyArgs) =>
  tx.attendance.findFirst({
    where: { id: args.attendanceId, organizationId: args.organizationId },
    select: moneySelect,
  })

/**
 * Занятие оплачено: списывает урок с очереди пакетов кошелька.
 *
 * Гасит головной пакет — самый ранний непотраченный — и копирует его цену урока
 * в строку. Дальше эта цена не пересчитывается, поэтому новые оплаты не двигают
 * закрытые месяцы. Если непотраченных пакетов нет, урок всё равно списывается,
 * по последней известной цене кошелька: школа занятие провела.
 *
 * Повторный вызов на уже списанной строке ничего не делает.
 */
export async function chargeAttendanceTx(
  tx: Prisma.TransactionClient,
  args: AttendanceMoneyArgs,
): Promise<void> {
  const attendance = await findAttendanceTx(tx, args)
  if (!attendance || attendance.amount) return

  const walletId = await walletOfAttendanceTx(tx, attendance)

  // Кошелька нет — списывать не с чего. Проводку всё равно перезаписываем: на
  // строке могла остаться цена от прошлого статуса.
  if (!walletId) {
    await tx.attendance.update({
      where: { id: attendance.id },
      data: { paymentId: null, price: 0, amount: 0 },
    })
    return
  }

  const packet = await tx.payment.findFirst({
    where: { walletId, status: 'ACTIVE', remaining: { gt: 0 } },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: { id: true, price: true, lessonCount: true },
  })

  if (packet) {
    await tx.payment.update({ where: { id: packet.id }, data: { remaining: { decrement: 1 } } })
  }

  const price = packet ? unitPrice(packet) : await walletUnitPrice(tx, walletId)

  await tx.attendance.update({
    where: { id: attendance.id },
    data: { paymentId: packet?.id ?? null, price, amount: 1 },
  })

  await recordEntryTx(tx, {
    attendance,
    walletId,
    kind: WalletEntryKind.CHARGE,
    quantity: -1,
    unitPrice: price,
    paymentId: packet?.id ?? null,
    actorUserId: args.actorUserId,
    comment: packet ? null : 'В долг: непотраченных пакетов не было',
  })

  await moveBalanceTx(tx, {
    attendance,
    walletId,
    delta: -1,
    reason: chargeReason(attendance),
    actorUserId: args.actorUserId,
    meta: args.meta,
  })
}

/**
 * Занятие больше не оплачено: возвращает урок в пакет и на баланс.
 *
 * Урок уходит в тот пакет, из которого был списан, а не в текущую голову
 * очереди: при пакетах разной цены иначе поедут и остатки, и признанная
 * выручка. Строку можно потом удалять — деньги уже сняты со строки.
 *
 * Исключение одно: пакет отменён. Деньги за него школа вернула, класть урок
 * обратно некуда и не за что — проводка снимается, баланс остаётся на месте.
 *
 * Повторный вызов на несписанной строке ничего не делает.
 */
export async function unchargeAttendanceTx(
  tx: Prisma.TransactionClient,
  /** `reason` — чем возврат назвать в истории; по умолчанию это откат отметки. */
  args: AttendanceMoneyArgs & { reason?: StudentLessonsBalanceChangeReason },
): Promise<void> {
  const attendance = await findAttendanceTx(tx, args)
  if (!attendance || !attendance.amount) return

  const packet = attendance.paymentId
    ? await tx.payment.findUnique({
        where: { id: attendance.paymentId },
        select: { walletId: true },
      })
    : null

  // Возврат в пакет — условным апдейтом: если оплату успели отменить, count = 0
  // и на баланс урок тоже не пойдёт.
  const returned = attendance.paymentId
    ? (
        await tx.payment.updateMany({
          where: { id: attendance.paymentId, status: 'ACTIVE' },
          data: { remaining: { increment: attendance.amount } },
        })
      ).count > 0
    : false

  await tx.attendance.update({ where: { id: attendance.id }, data: { amount: 0 } })

  // Урок возвращается в тот же кошелёк, где лежит его пакет: иначе баланс
  // разойдётся с остатками, если ученика с тех пор перевели на другой кошелёк.
  const walletId = packet?.walletId ?? (await walletOfAttendanceTx(tx, attendance))

  // Оплату отменили: урок не вернулся ни в пакет, ни на баланс. Событие всё
  // равно записываем — иначе в журнале останется списание без своей пары.
  if (attendance.paymentId && !returned) {
    await recordEntryTx(tx, {
      attendance,
      walletId,
      kind: WalletEntryKind.REVERSAL,
      quantity: 0,
      unitPrice: attendance.price ?? 0,
      paymentId: attendance.paymentId,
      actorUserId: args.actorUserId,
      comment: 'Оплата отменена — урок не возвращается',
    })
    return
  }

  await recordEntryTx(tx, {
    attendance,
    walletId,
    kind: WalletEntryKind.REVERSAL,
    quantity: attendance.amount,
    unitPrice: attendance.price ?? 0,
    paymentId: attendance.paymentId,
    actorUserId: args.actorUserId,
  })

  await moveBalanceTx(tx, {
    attendance,
    walletId,
    delta: attendance.amount,
    reason: args.reason ?? StudentLessonsBalanceChangeReason.ATTENDANCE_REVERTED,
    actorUserId: args.actorUserId,
    meta: args.meta,
  })
}

/**
 * Кошелёк списания: у разового посещения он выбран на самой строке, у обычного
 * берётся из группы. Отработка платит кошельком той группы, где случился
 * пропуск, а не той, куда ученик пришёл отрабатывать.
 */
async function walletOfAttendanceTx(
  tx: Prisma.TransactionClient,
  attendance: MoneyAttendance,
): Promise<number | null> {
  if (attendance.walletId) return attendance.walletId

  const groupId = attendance.makeupForAttendance
    ? attendance.makeupForAttendance.lesson.groupId
    : attendance.lesson.groupId

  const studentGroup = await tx.studentGroup.findUnique({
    where: { studentId_groupId: { studentId: attendance.studentId, groupId } },
    select: { walletId: true },
  })
  return studentGroup?.walletId ?? null
}

/**
 * Строка журнала — единственный способ записать движение остатка.
 *
 * Строки не правятся и не удаляются: ошибка исправляется встречной строкой.
 * `Σ quantity` по кошельку даёт его остаток, по пакету — остаток пакета.
 */
export async function recordWalletEntryTx(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: number
    walletId: number
    studentId: number
    kind: WalletEntryKind
    /** Уроки: + пришли, − ушли. Ноль — событие было, движения не было. */
    quantity: number
    unitPrice: number
    /** Бизнес-день: дата занятия или оплаты, а не дата записи. */
    effectiveAt: string
    paymentId?: number | null
    attendanceId?: number | null
    reversalOfId?: number | null
    actorUserId: number | null
    comment?: string | null
  },
): Promise<void> {
  await tx.walletEntry.create({
    data: {
      organizationId: args.organizationId,
      walletId: args.walletId,
      studentId: args.studentId,
      kind: args.kind,
      quantity: args.quantity,
      unitPrice: args.unitPrice,
      effectiveAt: args.effectiveAt,
      paymentId: args.paymentId ?? null,
      attendanceId: args.attendanceId ?? null,
      reversalOfId: args.reversalOfId ?? null,
      actorUserId: args.actorUserId,
      comment: args.comment ?? null,
    },
  })
}

/** Строка журнала по занятию. Бизнес-день берётся с самого занятия. */
async function recordEntryTx(
  tx: Prisma.TransactionClient,
  args: {
    attendance: MoneyAttendance
    walletId: number | null
    kind: WalletEntryKind
    quantity: number
    unitPrice: number
    paymentId: number | null
    actorUserId: number | null
    comment?: string | null
  },
): Promise<void> {
  const { attendance, walletId } = args
  if (!walletId) return

  // Откат ссылается на списание, которое отменяет: по этой ссылке журнал
  // читается парами, а `@unique` не даёт отменить одно списание дважды.
  const reversed =
    args.kind === WalletEntryKind.REVERSAL
      ? await tx.walletEntry.findFirst({
          where: {
            attendanceId: attendance.id,
            kind: WalletEntryKind.CHARGE,
            reversedBy: { is: null },
          },
          orderBy: { id: 'desc' },
          select: { id: true },
        })
      : null

  await recordWalletEntryTx(tx, {
    organizationId: attendance.organizationId,
    walletId,
    studentId: attendance.studentId,
    kind: args.kind,
    quantity: args.quantity,
    unitPrice: args.unitPrice,
    // День занятия, а не день отметки: внесённое задним числом попадает в свой
    // месяц, а не в тот, когда до него дошли руки.
    effectiveAt: attendance.lesson.date,
    paymentId: args.paymentId,
    attendanceId: attendance.id,
    reversalOfId: reversed?.id ?? null,
    actorUserId: args.actorUserId,
    comment: args.comment,
  })
}

/** Двигает баланс кошелька и пишет строку истории — всегда вместе. */
async function moveBalanceTx(
  tx: Prisma.TransactionClient,
  args: {
    attendance: MoneyAttendance
    walletId: number | null
    delta: number
    reason: StudentLessonsBalanceChangeReason
    actorUserId: number | null
    meta?: Record<string, unknown>
  },
): Promise<void> {
  const { attendance, walletId, delta } = args
  if (!walletId || !delta) return

  const wallet = await tx.wallet.findUnique({
    where: { id: walletId },
    select: { lessonsBalance: true },
  })
  if (!wallet) return

  const updated = await tx.wallet.update({
    where: { id: walletId },
    data: {
      lessonsBalance: delta > 0 ? { increment: delta } : { decrement: Math.abs(delta) },
    },
    select: { lessonsBalance: true },
  })

  await writeFinancialHistoryTx(tx, {
    organizationId: attendance.organizationId,
    studentId: attendance.studentId,
    actorUserId: args.actorUserId,
    groupId: attendance.lesson.groupId,
    walletId,
    field: StudentFinancialField.LESSONS_BALANCE,
    reason: args.reason,
    delta: updated.lessonsBalance - wallet.lessonsBalance,
    balanceBefore: wallet.lessonsBalance,
    balanceAfter: updated.lessonsBalance,
    meta: {
      attendanceId: attendance.id,
      lessonId: attendance.lessonId,
      groupId: attendance.lesson.groupId,
      isMakeupAttendance: Boolean(attendance.makeupForAttendanceId),
      ...args.meta,
    },
  })
}

const chargeReason = (attendance: MoneyAttendance): StudentLessonsBalanceChangeReason => {
  if (attendance.makeupForAttendanceId) {
    return StudentLessonsBalanceChangeReason.MAKEUP_ATTENDED_CHARGED
  }
  return attendance.status === AttendanceStatus.PRESENT
    ? StudentLessonsBalanceChangeReason.ATTENDANCE_PRESENT_CHARGED
    : StudentLessonsBalanceChangeReason.ATTENDANCE_ABSENT_CHARGED
}

const unitPrice = (p: { price: number; lessonCount: number }) =>
  p.lessonCount > 0 ? Math.floor(p.price / p.lessonCount) : 0

/**
 * Цена урока кошелька, когда непотраченных пакетов не осталось: цена самого
 * позднего его пакета, а если оплат не было вовсе — из счётчиков, оставшихся от
 * переезда на кошельки. Ноль означает, что про кошелёк не известно ничего.
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

/** Строка в журнале изменений баланса. Пишется вместе с самим изменением. */
export async function writeFinancialHistoryTx(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: number
    studentId: number
    actorUserId: number | null
    groupId?: number | null
    walletId?: number | null
    field: StudentFinancialField
    reason: StudentLessonsBalanceChangeReason
    delta: number
    balanceBefore: number
    balanceAfter: number
    comment?: string
    meta?: Prisma.InputJsonValue
  },
) {
  if (args.delta === 0) return

  await tx.studentLessonsBalanceHistory.create({
    data: {
      organizationId: args.organizationId,
      studentId: args.studentId,
      actorUserId: args.actorUserId,
      groupId: args.groupId ?? null,
      walletId: args.walletId ?? null,
      field: args.field,
      reason: args.reason,
      delta: args.delta,
      balanceBefore: args.balanceBefore,
      balanceAfter: args.balanceAfter,
      comment: args.comment,
      meta: args.meta,
    },
  })
}
