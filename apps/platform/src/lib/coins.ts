import type { Prisma } from '@repo/db'
import { CoinTxReason } from '@repo/db/enums'

/**
 * Пишет строку в леджер астрокоинов.
 *
 * Инвариант: сумма `CoinTransaction.amount` по ученику равна его
 * `StudentAccount.coins`. Поэтому вызов обязан лежать в ТОЙ ЖЕ транзакции, что и
 * изменение `coins` — само изменение остаётся на вызывающем, потому что оно
 * везде разное (`increment`, `decrement`, условный `updateMany`).
 */
export async function recordCoins(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: number
    studentId: number
    amount: number
    reason: CoinTxReason
    orderId?: number
    attendanceId?: number
  },
): Promise<void> {
  await tx.coinTransaction.create({
    data: {
      organizationId: args.organizationId,
      studentId: args.studentId,
      amount: args.amount,
      reason: args.reason,
      orderId: args.orderId ?? null,
      attendanceId: args.attendanceId ?? null,
    },
  })
}

/** Награда за посещение. Настройки размера в v1 нет (§13.1 SPEC). */
export const ATTENDANCE_COINS = 10
