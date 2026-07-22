'use server'

import prisma from '@/src/lib/db/prisma'
import { ForbiddenError, NotFoundError } from '@/src/lib/error'
import { authAction } from '@/src/lib/safe-action'
import { addDays, addMonths, endOfMonth, startOfMonth } from 'date-fns'
import {
  CreateManagerSalarySchema,
  DeleteManagerSalarySchema,
  ManagerSalaryRangeSchema,
  UpdateManagerSalarySchema,
} from './schemas'
import type { ManagerSalaryBreakdown, ManagerSalaryData } from './types'

const pad = (n: number) => String(n).padStart(2, '0')
/** Date → `YYYY-MM-DD` по UTC-компонентам (для date-only строковых колонок). */
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

async function assertOwner(memberRole: string | null | undefined) {
  if (memberRole !== 'owner') {
    throw new ForbiddenError('Только владелец может изменять зарплату менеджера')
  }
}

async function assertManagerMember(userId: number, organizationId: number) {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
  })
  if (!member) {
    throw new NotFoundError('Пользователь не состоит в организации')
  }
  if (member.role !== 'manager' && member.role !== 'owner') {
    throw new ForbiddenError('Фиксированная зарплата доступна только для менеджеров')
  }
}

// ─── Queries ────────────────────────────────────────────────────────

export const getManagerSalaries = authAction
  .metadata({ actionName: 'getManagerSalaries' })
  .action(async ({ ctx }) => {
    return await prisma.managerSalary.findMany({
      where: { organizationId: ctx.session.organizationId! },
      include: { user: true },
      orderBy: [{ userId: 'asc' }, { startDate: 'desc' }],
    })
  })

export const getMyManagerSalaries = authAction
  .metadata({ actionName: 'getMyManagerSalaries' })
  .action(async ({ ctx }) => {
    return await prisma.managerSalary.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
      include: { user: true },
      orderBy: { startDate: 'desc' },
    })
  })

// ─── Mutations ──────────────────────────────────────────────────────

export const createManagerSalary = authAction
  .metadata({ actionName: 'createManagerSalary' })
  .inputSchema(CreateManagerSalarySchema)
  .action(async ({ ctx, parsedInput }) => {
    await assertOwner(ctx.session.memberRole)
    const organizationId = ctx.session.organizationId!
    await assertManagerMember(parsedInput.userId, organizationId)

    const { userId, monthlyAmount, month, year, comment } = parsedInput
    const startDateObj = new Date(Date.UTC(year!, month!, 1))
    const startDate = ymd(startDateObj)
    const endDate = null
    await prisma.$transaction(async (tx) => {
      // Auto-close previous open-ended rows that start before this one
      if (!endDate) {
        await tx.managerSalary.updateMany({
          where: {
            organizationId,
            userId,
            endDate: null,
            startDate: { lt: startDate },
          },
          data: { endDate: ymd(addDays(startDateObj, -1)) },
        })
      }
      await tx.managerSalary.create({
        data: {
          organizationId,
          userId,
          monthlyAmount,
          startDate,
          endDate: endDate ?? null,
          comment: comment ?? null,
        },
      })
    })
  })

export const updateManagerSalary = authAction
  .metadata({ actionName: 'updateManagerSalary' })
  .inputSchema(UpdateManagerSalarySchema)
  .action(async ({ ctx, parsedInput }) => {
    await assertOwner(ctx.session.memberRole)
    const organizationId = ctx.session.organizationId!
    const { id, userId, monthlyAmount, month, year, comment } = parsedInput
    await assertManagerMember(userId, organizationId)
    const startDate = ymd(new Date(Date.UTC(year!, month!, 1)))
    const endDate = null
    await prisma.managerSalary.update({
      where: { id, organizationId },
      data: {
        userId,
        monthlyAmount,
        startDate,
        endDate: endDate ?? null,
        comment: comment ?? null,
      },
    })
  })

export const deleteManagerSalary = authAction
  .metadata({ actionName: 'deleteManagerSalary' })
  .inputSchema(DeleteManagerSalarySchema)
  .action(async ({ ctx, parsedInput }) => {
    await assertOwner(ctx.session.memberRole)
    await prisma.managerSalary.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })

// ─── Aggregation ────────────────────────────────────────────────────

export const getManagerSalaryData = authAction
  .metadata({ actionName: 'getManagerSalaryData' })
  .inputSchema(ManagerSalaryRangeSchema)
  .action(async ({ ctx, parsedInput }): Promise<ManagerSalaryData> => {
    await assertOwner(ctx.session.memberRole)
    const organizationId = ctx.session.organizationId!
    const { startDate, endDate, userIds } = parsedInput

    const rangeStart = new Date(startDate)
    const rangeEnd = new Date(endDate)
    const rangeStartYmd = ymd(rangeStart)
    const rangeEndYmd = ymd(rangeEnd)

    // All managers (and owners - they might have a salary too) in the org
    const managerMembers = await prisma.member.findMany({
      where: {
        organizationId,
        role: { in: ['manager', 'owner'] },
        ...(userIds && userIds.length > 0 ? { userId: { in: userIds } } : {}),
      },
      include: { user: true },
    })

    const managerUserIds = managerMembers.map((m) => m.userId)
    if (managerUserIds.length === 0) {
      return { breakdowns: [], grandTotal: 0 }
    }

    const [salaries, paychecks] = await Promise.all([
      prisma.managerSalary.findMany({
        where: { organizationId, userId: { in: managerUserIds } },
        orderBy: { startDate: 'desc' },
      }),
      prisma.payCheck.findMany({
        where: {
          organizationId,
          userId: { in: managerUserIds },
          date: { gte: rangeStartYmd, lte: rangeEndYmd },
        },
      }),
    ])

    const breakdowns: ManagerSalaryBreakdown[] = managerMembers.map((member) => {
      const userId = member.userId
      const userSalaries = salaries.filter((s) => s.userId === userId)

      // Iterate whole months within range. Whole-month semantics:
      // a month is charged in full if any part of it overlaps with range.
      let fixedTotal = 0
      let cursor = startOfMonth(rangeStart)
      const lastMonth = startOfMonth(rangeEnd)
      while (cursor.getTime() <= lastMonth.getTime()) {
        const monthStart = cursor
        const monthEnd = endOfMonth(cursor)
        // Pick the latest applicable salary row for this month
        const applicable = userSalaries.find(
          (s) =>
            new Date(s.startDate).getTime() <= monthEnd.getTime() &&
            (s.endDate === null || new Date(s.endDate).getTime() >= monthStart.getTime()),
        )
        if (applicable) {
          fixedTotal += applicable.monthlyAmount
        }
        cursor = addMonths(cursor, 1)
      }

      const userPaychecks = paychecks.filter((p) => p.userId === userId)
      const bonusTotal = userPaychecks
        .filter((p) => p.type === 'BONUS')
        .reduce((sum, p) => sum + p.amount, 0)
      const advanceTotal = userPaychecks
        .filter((p) => p.type === 'ADVANCE')
        .reduce((sum, p) => sum + p.amount, 0)
      const salaryPayoutsTotal = userPaychecks
        .filter((p) => p.type === 'SALARY')
        .reduce((sum, p) => sum + p.amount, 0)

      return {
        userId,
        userName: member.user.name,
        fixedTotal,
        bonusTotal,
        advanceTotal,
        salaryPayoutsTotal,
        total: fixedTotal + bonusTotal,
      }
    })

    // Keep only those with some activity in the period
    const filtered = breakdowns.filter(
      (b) => b.fixedTotal > 0 || b.bonusTotal > 0 || b.advanceTotal > 0 || b.salaryPayoutsTotal > 0,
    )

    const grandTotal = filtered.reduce((sum, b) => sum + b.total, 0)

    return { breakdowns: filtered, grandTotal }
  })
