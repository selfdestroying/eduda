import { type Prisma, prisma } from '@repo/db'

import { type ChargeableStatus, type StudentRevenueEntry } from './chargeable'

/**
 * Признанная выручка по посещениям: `price × amount`, записанные в строку в момент
 * списания (см. `ledger.server.ts`). Ничего не делится и не усредняется на чтение,
 * поэтому отчёт за закрытый месяц не меняется от новых оплат.
 *
 * Используется «Авансами» и «Прибылью».
 *
 * Про `chargeableStatuses`: списание случается только у присутствовавших и у тех, кто
 * пропустил без предупреждения, — у остальных `amount = 0`. Поэтому фильтр отбирает
 * ровно эти классы, а «Предупредил, без отработки» и «отработка не засчитана» денег
 * не приносят ни при каком выборе: их уроки школе не оплачивались.
 */
export async function computeAttendanceRevenue(params: {
  organizationId: number
  /** Границы диапазона в формате `YYYY-MM-DD` (включительно). */
  startDate: string
  endDate: string
  chargeableStatuses: ChargeableStatus[]
}): Promise<StudentRevenueEntry[]> {
  const { organizationId, startDate, endDate, chargeableStatuses } = params

  const classes: Prisma.AttendanceWhereInput[] = []
  if (chargeableStatuses.includes('present')) {
    classes.push({ status: 'PRESENT', makeupForAttendanceId: null })
  }
  if (chargeableStatuses.includes('absent_no_warn')) {
    // `isWarned: { not: true }` здесь не годится: в SQL сравнение с NULL даёт NULL,
    // и пропуски с непроставленным флагом — а таких большинство — выпали бы из выручки.
    classes.push({ status: 'ABSENT', OR: [{ isWarned: false }, { isWarned: null }] })
  }
  // Отработка зарабатывает на своей дате, а не на дате пропущенного урока: деньги
  // признаются тогда, когда занятие фактически провели.
  if (chargeableStatuses.includes('makeup_success')) {
    classes.push({ status: 'PRESENT', makeupForAttendanceId: { not: null } })
  }
  if (classes.length === 0) return []

  const rows = await prisma.attendance.findMany({
    where: {
      organizationId,
      amount: { gt: 0 },
      lesson: { status: 'ACTIVE', date: { gte: startDate, lte: endDate } },
      OR: classes,
    },
    select: {
      studentId: true,
      price: true,
      amount: true,
      lesson: { select: { date: true } },
    },
  })

  return rows.map((r) => ({
    studentId: r.studentId,
    visitCost: (r.price ?? 0) * (r.amount ?? 0),
    lessonDate: r.lesson.date,
  }))
}
