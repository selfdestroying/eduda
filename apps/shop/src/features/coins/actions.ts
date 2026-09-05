'use server'

import { formatInTz, todayYmdInTz } from '@repo/core/timezone'
import { studentAction } from '@/src/lib/safe-action'
import { prisma } from '@repo/db'
import type { CoinTxReason } from '@repo/db/enums'
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

/**
 * «Заработанные» — не то же самое, что «положительные». Возврат за отменённый
 * заказ и начальный баланс к учёбе отношения не имеют, а покупка не должна ронять
 * место в рейтинге: потраченное не считается. Отмена посещения и ручное списание,
 * наоборот, входят — это минус к уже начисленному, иначе снятая задним числом
 * отметка рейтинг не чинит.
 */
const EARNED_REASONS: CoinTxReason[] = [
  'ATTENDANCE_PRESENT',
  'ATTENDANCE_REVERTED',
  'MANUAL_GRANT',
  'MANUAL_DEDUCT',
  'ACHIEVEMENT_CLAIM',
]

/** Сколько строк рейтинга показываем; награждают топ-3, остальное — на что равняться. */
const TOP_SIZE = 10

/**
 * Рейтинг школы по заработанным за текущий календарный месяц коинам.
 *
 * Месяц закрывается сам: границы берутся от «сегодня» в поясе школы и считаются
 * на чтение, поэтому ручного сброса первого числа не существует.
 *
 * Фамилия сокращена до инициала: рейтинг видит вся школа, включая другие города,
 * и полный список детей с фамилиями там не нужен.
 */
export const getMonthlyCoinRanking = studentAction
  .metadata({ actionName: 'getMonthlyCoinRanking' })
  .action(async ({ ctx }) => {
    const tz = ctx.org.timezone
    const monthPrefix = todayYmdInTz(tz).slice(0, 7)

    // Грубое окно по UTC, точная граница — ниже, по дню каждой строки в поясе
    // школы. Сутки запаса перекрывают любой сдвиг пояса относительно UTC.
    const since = new Date(`${monthPrefix}-01T00:00:00Z`)
    since.setUTCDate(since.getUTCDate() - 1)

    const rows = await prisma.coinTransaction.findMany({
      where: {
        organizationId: ctx.student.organizationId,
        createdAt: { gte: since },
        reason: { in: EARNED_REASONS },
      },
      select: { studentId: true, amount: true, createdAt: true },
    })

    const earned = new Map<number, number>()
    for (const row of rows) {
      if (!formatInTz(row.createdAt, tz, 'yyyy-MM-dd').startsWith(monthPrefix)) continue
      earned.set(row.studentId, (earned.get(row.studentId) ?? 0) + row.amount)
    }

    const scored = Array.from(earned.entries())
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])

    const students = await prisma.student.findMany({
      where: {
        id: { in: scored.map(([studentId]) => studentId) },
        organizationId: ctx.student.organizationId,
      },
      select: { id: true, firstName: true, lastName: true },
    })
    const nameById = new Map(
      students.map((s) => [s.id, `${s.firstName} ${s.lastName.slice(0, 1)}.`]),
    )

    // Равные суммы делят место (1, 2, 2, 4): иначе порядок между одинаковыми
    // решает id, и школа наградит одного из двух ничем не отличающихся учеников.
    let place = 0
    let prevAmount: number | null = null
    const ranking = scored.map(([studentId, amount], index) => {
      if (amount !== prevAmount) {
        place = index + 1
        prevAmount = amount
      }
      return { place, studentId, name: nameById.get(studentId) ?? 'Ученик', amount }
    })

    return {
      month: monthPrefix,
      top: ranking.slice(0, TOP_SIZE),
      /** Своя строка отдельно: ученик вне топа всё равно должен видеть место. */
      me: ranking.find((entry) => entry.studentId === ctx.student.id) ?? null,
    }
  })
