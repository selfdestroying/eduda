import 'server-only'

import { Prisma } from '@/prisma/generated/client'
import { StudentFinancialField, StudentLessonsBalanceChangeReason } from '@/prisma/generated/enums'

export type LessonsBalanceAudit = {
  reason: StudentLessonsBalanceChangeReason
  comment?: string
  meta?: Prisma.JsonValue
}

/** Audit payload keyed by financial field */
export type StudentFinancialAudit = {
  [K in StudentFinancialField]?: LessonsBalanceAudit
}

type IntFieldChange = { kind: 'delta'; delta: number } | { kind: 'set'; value: number }

export function parseIntFieldChange(
  value: Prisma.StudentUpdateInput['lessonsBalance'],
): IntFieldChange | null {
  if (value === undefined) return null

  if (typeof value === 'number') {
    return { kind: 'set', value }
  }

  if (value && typeof value === 'object') {
    const ops = value as Prisma.IntFieldUpdateOperationsInput

    if (typeof ops.increment === 'number') return { kind: 'delta', delta: ops.increment }
    if (typeof ops.decrement === 'number') return { kind: 'delta', delta: -ops.decrement }
    if (typeof ops.set === 'number') return { kind: 'set', value: ops.set }
  }

  return null
}

/**
 * @deprecated Use parseIntFieldChange instead
 */
export const parseLessonsBalanceChange = parseIntFieldChange

export async function writeFinancialHistoryTx(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: number
    studentId: number
    actorUserId: number
    groupId?: number | null
    field: StudentFinancialField
    reason: StudentLessonsBalanceChangeReason
    delta: number
    balanceBefore: number
    balanceAfter: number
    comment?: string
    meta?: Prisma.JsonValue
  },
) {
  if (args.delta === 0) return

  await tx.studentLessonsBalanceHistory.create({
    data: {
      studentId: args.studentId,
      actorUserId: args.actorUserId,
      groupId: args.groupId ?? null,
      field: args.field,
      reason: args.reason,
      delta: args.delta,
      balanceBefore: args.balanceBefore,
      balanceAfter: args.balanceAfter,
      comment: args.comment,
      meta: args.meta as Prisma.InputJsonValue,
      organizationId: args.organizationId,
    },
  })
}

/**
 * @deprecated Use writeFinancialHistoryTx instead
 */
export async function writeLessonsBalanceHistoryTx(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: number
    studentId: number
    actorUserId: number
    groupId?: number | null
    reason: StudentLessonsBalanceChangeReason
    delta: number
    balanceBefore: number
    balanceAfter: number
    comment?: string
    meta?: Prisma.JsonValue
  },
) {
  return writeFinancialHistoryTx(tx, {
    ...args,
    field: StudentFinancialField.LESSONS_BALANCE,
  })
}

/** Mapping from StudentFinancialField to the corresponding Student model key */
export const FINANCIAL_FIELD_KEY: Record<
  StudentFinancialField,
  'lessonsBalance' | 'totalPayments' | 'totalLessons'
> = {
  [StudentFinancialField.LESSONS_BALANCE]: 'lessonsBalance',
  [StudentFinancialField.TOTAL_PAYMENTS]: 'totalPayments',
  [StudentFinancialField.TOTAL_LESSONS]: 'totalLessons',
}
