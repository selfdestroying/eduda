'use server'

import { studentAction } from '@/src/lib/safe-action'
import { prisma } from '@repo/db'
import * as z from 'zod'

/**
 * Баланс астрокоинов и история его изменений.
 *
 * `StudentAccount.coins` — денормализованный кеш, история — источник правды;
 * инвариант «сумма леджера = coins» держат пишущие стороны (платформа и чекаут).
 * Здесь только чтение, поэтому баланс берём из кеша, не пересчитывая.
 */
export const getCoinHistory = studentAction
  .metadata({ actionName: 'getCoinHistory' })
  .inputSchema(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
  .action(async ({ ctx, parsedInput }) => {
    const [account, items] = await Promise.all([
      prisma.studentAccount.findFirst({
        where: { studentId: ctx.student.id, organizationId: ctx.student.organizationId },
        select: { coins: true },
      }),
      prisma.coinTransaction.findMany({
        where: { studentId: ctx.student.id, organizationId: ctx.student.organizationId },
        select: { id: true, amount: true, reason: true, createdAt: true, orderId: true },
        orderBy: { id: 'desc' },
        take: parsedInput.limit,
      }),
    ])

    return { balance: account?.coins ?? 0, items }
  })
