import prisma from '@/src/lib/db/prisma'

import { type ChargeableStatus, isChargeable, type StudentRevenueEntry } from './chargeable'

/**
 * Computes per-attendance visit costs using wallet-based pricing.
 * Returns flat array of { studentId, visitCost, lessonDate } for each
 * chargeable attendance in the date range.
 *
 * Used by both revenue and advances pages.
 */
export async function computeAttendanceRevenue(params: {
  organizationId: number
  /** Границы диапазона в формате `YYYY-MM-DD` (включительно). */
  startDate: string
  endDate: string
  chargeableStatuses: ChargeableStatus[]
}): Promise<StudentRevenueEntry[]> {
  const { organizationId, startDate, endDate, chargeableStatuses } = params

  const lessons = await prisma.lesson.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      date: { gte: startDate, lte: endDate },
    },
    select: {
      group: { select: { id: true } },
      date: true,
      attendance: {
        where: { makeupForAttendanceId: null },
        select: {
          studentId: true,
          status: true,
          isWarned: true,
          makeupAttendance: { select: { status: true } },
          student: {
            select: {
              wallets: {
                select: {
                  totalLessons: true,
                  totalPayments: true,
                  studentGroups: { select: { groupId: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const entries: StudentRevenueEntry[] = []

  for (const lesson of lessons) {
    for (const att of lesson.attendance) {
      if (!isChargeable(att, chargeableStatuses)) continue

      const wallet = att.student.wallets.find((w) =>
        w.studentGroups.some((sg) => sg.groupId === lesson.group.id),
      )
      if (!wallet || wallet.totalLessons <= 0) continue

      entries.push({
        studentId: att.studentId,
        visitCost: wallet.totalPayments / wallet.totalLessons,
        lessonDate: lesson.date,
      })
    }
  }

  return entries
}
