import type { Prisma } from '@repo/db'
import {
  AttendanceStatus,
  StudentFinancialField,
  StudentLessonsBalanceChangeReason,
} from '@repo/db/enums'

/**
 * Денежное ядро: единственное место, где посещение превращается в деньги.
 *
 * Наружу торчат ровно две операции — «занятие оплачено» и «занятие больше не
 * оплачено». Каждая делает всё, что за этим стоит: гасит или возвращает урок в
 * пакет, двигает баланс кошелька, переписывает проводку на строке и пишет
 * историю. Вызывающему не остаётся ни одной обязанности, про которую можно
 * забыть, — раньше их было четыре, и каждый из шести вызовов брал на себя свой
 * набор.
 *
 * Живёт отдельно от экшенов, чтобы `scripts/check-payment-packets.ts` мог
 * прогнать денежную логику против настоящей БД, не поднимая сессию. По той же
 * причине здесь нет `server-only` и импортов из `@/src/lib`.
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
  status: true,
  lessonId: true,
  makeupForAttendanceId: true,
  lesson: { select: { groupId: true } },
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

  await tx.attendance.update({
    where: { id: attendance.id },
    data: {
      paymentId: packet?.id ?? null,
      price: packet ? unitPrice(packet) : await walletUnitPrice(tx, walletId),
      amount: 1,
    },
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

  if (attendance.paymentId && !returned) return

  // Урок возвращается в тот же кошелёк, где лежит его пакет: иначе баланс
  // разойдётся с остатками, если ученика с тех пор перевели на другой кошелёк.
  const walletId = packet?.walletId ?? (await walletOfAttendanceTx(tx, attendance))

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
