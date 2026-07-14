'use server'

import {
  TAX_SYSTEM_CONFIG_SCHEMAS,
  TAX_SYSTEMS,
  type TaxSystemKey,
  type UsnIncomeConfig,
} from '@/src/features/organization/tax-systems/schemas'
import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { nowInTz } from '@/src/lib/timezone'
import { endOfMonth, startOfMonth } from 'date-fns'
import { DEFAULT_CHARGEABLE_STATUSES } from '../chargeable'
import { computeAttendanceRevenue } from '../chargeable.server'
import { ProfitMonthlyFiltersSchema } from './schemas'
import type {
  AcquiringBreakdownItem,
  ExpenseBreakdownItem,
  ProfitMonthEntry,
  ProfitMonthlyData,
  RentBreakdownItem,
  SalaryData,
  TaxBreakdown,
} from './types'

const MONTH_LABELS_RU = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

export const getProfitMonthlyData = authAction
  .metadata({ actionName: 'getProfitMonthlyData' })
  .inputSchema(ProfitMonthlyFiltersSchema)
  .action(async ({ ctx, parsedInput }): Promise<ProfitMonthlyData> => {
    const { year } = parsedInput
    const organizationId = ctx.session.organizationId!

    // Границы года как date-only строки для фильтров по строковым колонкам дат.
    const yearStartYmd = `${year}-01-01`
    const yearEndYmd = `${year}-12-31`

    // Pre-compute month boundaries
    const monthStarts = Array.from({ length: 12 }, (_, i) => startOfMonth(new Date(year, i, 1)))
    const monthEnds = monthStarts.map((d) => endOfMonth(d))

    // Init per-month accumulators
    const revenuePerMonth = new Array<number>(12).fill(0)
    const acquiringPerMonth = new Array<number>(12).fill(0)
    const salariesPerMonth = new Array<number>(12).fill(0)
    const rentPerMonth = new Array<number>(12).fill(0)
    const expensesPerMonth = new Array<number>(12).fill(0)

    // Per-month breakdown accumulators
    const acquiringMethodsPerMonth: Map<
      number,
      { name: string; commission: number; totalPayments: number }
    >[] = Array.from({ length: 12 }, () => new Map())
    const rentLocationsPerMonth: Map<string, number>[] = Array.from({ length: 12 }, () => new Map())
    const expenseNamesPerMonth: Map<string, number>[] = Array.from({ length: 12 }, () => new Map())
    const salaryLessonsPerMonth = new Array<number>(12).fill(0)
    const salaryPaychecksPerMonth = new Array<number>(12).fill(0)
    const salaryManagerFixedPerMonth = new Array<number>(12).fill(0)
    const salaryManagerPaychecksPerMonth = new Array<number>(12).fill(0)
    const teacherIdsPerMonth: Set<number>[] = Array.from({ length: 12 }, () => new Set())
    const managerIdsPerMonth: Set<number>[] = Array.from({ length: 12 }, () => new Set())
    const lessonCountPerMonth = new Array<number>(12).fill(0)

    // ── 1. Revenue (per attendance/lesson date) ─────────────────────────────
    const revenueEntries = await computeAttendanceRevenue({
      organizationId,
      startDate: yearStartYmd,
      endDate: yearEndYmd,
      chargeableStatuses: [...DEFAULT_CHARGEABLE_STATUSES],
    })
    for (const e of revenueEntries) {
      const m = new Date(e.lessonDate).getMonth()
      revenuePerMonth[m]! += e.visitCost
    }

    // ── 2. Acquiring (per payment.date) ─────────────────────────────────────
    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        date: { gte: yearStartYmd, lte: yearEndYmd },
      },
      select: {
        date: true,
        price: true,
        paymentMethod: {
          select: { id: true, name: true, commission: true },
        },
      },
    })
    for (const p of payments) {
      if (!p.paymentMethod) continue
      const m = new Date(p.date).getMonth()
      acquiringPerMonth[m]! += p.price * (p.paymentMethod.commission / 100)
      const bucket = acquiringMethodsPerMonth[m]!
      const { id, name, commission } = p.paymentMethod
      const existing = bucket.get(id)
      if (existing) existing.totalPayments += p.price
      else bucket.set(id, { name, commission, totalPayments: p.price })
    }

    // ── 3. Salaries: lessons + paychecks (per their date) ───────────────────
    const lessons = await prisma.lesson.findMany({
      where: {
        organizationId,
        date: { gte: yearStartYmd, lte: yearEndYmd },
        status: { not: 'CANCELLED' },
      },
      select: {
        date: true,
        teachers: {
          select: { bid: true, bonusPerStudent: true, teacherId: true },
        },
        _count: { select: { attendance: { where: { status: 'PRESENT' } } } },
      },
    })
    for (const lesson of lessons) {
      const m = new Date(lesson.date).getMonth()
      const presentCount = lesson._count?.attendance ?? 0
      let lessonTotal = 0
      for (const tl of lesson.teachers) {
        lessonTotal += tl.bid + tl.bonusPerStudent * presentCount
        teacherIdsPerMonth[m]!.add(tl.teacherId)
      }
      salariesPerMonth[m]! += lessonTotal
      salaryLessonsPerMonth[m]! += lessonTotal
      lessonCountPerMonth[m]! += 1
    }

    const paychecks = await prisma.payCheck.findMany({
      where: {
        organizationId,
        date: { gte: yearStartYmd, lte: yearEndYmd },
      },
      select: { date: true, amount: true, userId: true, type: true },
    })
    const membersForYear = await prisma.member.findMany({
      where: { organizationId },
      select: { userId: true, role: true },
    })
    const managerUserIdsYear = new Set(
      membersForYear.filter((m) => m.role === 'manager' || m.role === 'owner').map((m) => m.userId),
    )
    for (const p of paychecks) {
      const m = new Date(p.date).getMonth()
      salariesPerMonth[m]! += p.amount
      if (managerUserIdsYear.has(p.userId) && p.type === 'BONUS') {
        salaryManagerPaychecksPerMonth[m]! += p.amount
        managerIdsPerMonth[m]!.add(p.userId)
      } else {
        salaryPaychecksPerMonth[m]! += p.amount
      }
    }

    // Manager fixed salaries per month (whole-month with supersession)
    const managerSalariesYear = await prisma.managerSalary.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
    })
    const managerSalariesByUserYear = new Map<number, typeof managerSalariesYear>()
    for (const s of managerSalariesYear) {
      const arr = managerSalariesByUserYear.get(s.userId) ?? []
      arr.push(s)
      managerSalariesByUserYear.set(s.userId, arr)
    }
    for (const [userId, rows] of managerSalariesByUserYear) {
      for (let m = 0; m < 12; m++) {
        const monthStart = monthStarts[m]!
        const monthEnd = monthEnds[m]!
        const applicable = rows.find(
          (s) =>
            new Date(s.startDate).getTime() <= monthEnd.getTime() &&
            (s.endDate === null || new Date(s.endDate).getTime() >= monthStart.getTime()),
        )
        if (applicable) {
          salariesPerMonth[m]! += applicable.monthlyAmount
          salaryManagerFixedPerMonth[m]! += applicable.monthlyAmount
          managerIdsPerMonth[m]!.add(userId)
        }
      }
    }

    // ── 4. Rent (distribute pro-rata by overlap days) ───────────────────────
    const rents = await prisma.rent.findMany({
      where: {
        organizationId,
        startDate: { lte: yearEndYmd },
        OR: [{ endDate: null }, { endDate: { gte: yearStartYmd } }],
      },
      select: {
        amount: true,
        isMonthly: true,
        startDate: true,
        endDate: true,
        locationId: true,
        location: { select: { name: true } },
      },
    })

    // Compute per-monthly-rent cutoff month index (exclusive): a newer monthly
    // rent at the same location supersedes the earlier one from its start month.
    const monthIdxOf = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth()
    const monthlyEndIdx = new Map<number, number>()
    const monthlyByLocation = new Map<number, { idx: number; startIdx: number }[]>()
    rents.forEach((r, idx) => {
      if (!r.isMonthly) return
      if (!monthlyByLocation.has(r.locationId)) monthlyByLocation.set(r.locationId, [])
      monthlyByLocation.get(r.locationId)!.push({
        idx,
        startIdx: monthIdxOf(new Date(r.startDate)),
      })
    })
    for (const arr of monthlyByLocation.values()) {
      arr.sort((a, b) => a.startIdx - b.startIdx)
      for (let i = 0; i < arr.length; i++) {
        monthlyEndIdx.set(arr[i]!.idx, arr[i + 1]?.startIdx ?? Number.POSITIVE_INFINITY)
      }
    }

    rents.forEach((r, idx) => {
      const rStart = new Date(r.startDate)
      const locationName = r.location.name

      if (r.isMonthly) {
        // Monthly recurring: add full amount for each month in this year
        // from rStart's month up to (but not including) cutoff month.
        const startIdx = monthIdxOf(rStart)
        const cutoffIdx = monthlyEndIdx.get(idx) ?? Number.POSITIVE_INFINITY
        for (let m = 0; m < 12; m++) {
          const monthIdx = year * 12 + m
          if (monthIdx < startIdx || monthIdx >= cutoffIdx) continue
          rentPerMonth[m]! += r.amount
          const bucket = rentLocationsPerMonth[m]!
          bucket.set(locationName, (bucket.get(locationName) ?? 0) + r.amount)
        }
        return
      }

      const rEnd = r.endDate ? new Date(r.endDate) : null
      if (!rEnd) return // safety: non-monthly should always have endDate
      const totalRentMs = rEnd.getTime() - rStart.getTime()
      if (totalRentMs <= 0) {
        // Single-day or invalid range: attribute to month of startDate (if in year)
        const m = rStart.getFullYear() === year ? rStart.getMonth() : -1
        if (m >= 0) {
          rentPerMonth[m]! += r.amount
          const bucket = rentLocationsPerMonth[m]!
          bucket.set(locationName, (bucket.get(locationName) ?? 0) + r.amount)
        }
        return
      }
      for (let i = 0; i < 12; i++) {
        const overlapStart = Math.max(rStart.getTime(), monthStarts[i]!.getTime())
        const overlapEnd = Math.min(rEnd.getTime(), monthEnds[i]!.getTime())
        if (overlapEnd <= overlapStart) continue
        const ratio = (overlapEnd - overlapStart) / totalRentMs
        const share = r.amount * ratio
        rentPerMonth[i]! += share
        const bucket = rentLocationsPerMonth[i]!
        bucket.set(locationName, (bucket.get(locationName) ?? 0) + share)
      }
    })

    // ── 5. Other expenses (per expense.date) ────────────────────────────────
    const expensesRaw = await prisma.expense.findMany({
      where: {
        organizationId,
        date: { gte: yearStartYmd, lte: yearEndYmd },
      },
      select: { date: true, name: true, amount: true },
    })
    for (const e of expensesRaw) {
      const m = new Date(e.date).getMonth()
      expensesPerMonth[m]! += e.amount
      const bucket = expenseNamesPerMonth[m]!
      bucket.set(e.name, (bucket.get(e.name) ?? 0) + e.amount)
    }

    // ── 6. Taxes (USN_INCOME): evenly spread annual contributions ──────────
    const taxConfig = await prisma.taxConfig.findUnique({ where: { organizationId } })
    const taxSystem = (taxConfig?.taxSystem ?? 'USN_INCOME') as TaxSystemKey
    const taxSystemMeta = TAX_SYSTEMS.find((s) => s.value === taxSystem)
    const taxSystemLabel = taxSystemMeta?.label ?? taxSystem

    const taxesPerMonth = new Array<number>(12).fill(0)
    const incomeTaxPerMonth = new Array<number>(12).fill(0)
    let monthlyInsuranceAnnual = 0
    let monthlyFixedAnnual = 0
    let incomeTaxRate = 0

    if (taxSystem === 'USN_INCOME') {
      const schema = TAX_SYSTEM_CONFIG_SCHEMAS.USN_INCOME
      const config = schema.parse(
        (taxConfig?.config as Record<string, unknown>) ?? {},
      ) as UsnIncomeConfig

      incomeTaxRate = config.incomeTaxRate

      // Annual totals
      const annualRevenue = revenuePerMonth.reduce((s, v) => s + v, 0)
      const annualExcess = Math.max(0, annualRevenue - config.insuranceThreshold)
      const annualInsurance = annualExcess * (config.insuranceRate / 100)

      // 1/12 of fixed contributions and 1/12 of annual 1%-over-threshold insurance
      monthlyFixedAnnual = config.fixedContributions / 12
      monthlyInsuranceAnnual = annualInsurance / 12

      for (let i = 0; i < 12; i++) {
        const monthRev = revenuePerMonth[i]!
        const incomeTax = monthRev * (config.incomeTaxRate / 100)
        incomeTaxPerMonth[i] = incomeTax
        taxesPerMonth[i] = incomeTax + monthlyInsuranceAnnual + monthlyFixedAnnual
      }
    }

    // ── 7. Build response ───────────────────────────────────────────────────
    // Future months (past the current month in the current year) show zeros.
    const now = nowInTz(ctx.tz)
    const isCurrentYear = now.getFullYear() === year
    const currentMonthIndex = now.getMonth()

    const months: ProfitMonthEntry[] = monthStarts.map((startDate, i) => {
      const isFuture = isCurrentYear && i > currentMonthIndex
      const revenue = isFuture ? 0 : Math.round(revenuePerMonth[i]!)
      const taxes = isFuture ? 0 : Math.round(taxesPerMonth[i]!)
      const acquiring = isFuture ? 0 : Math.round(acquiringPerMonth[i]!)
      const salaries = isFuture ? 0 : Math.round(salariesPerMonth[i]!)
      const rent = isFuture ? 0 : Math.round(rentPerMonth[i]!)
      const expenses = isFuture ? 0 : Math.round(expensesPerMonth[i]!)
      const profit = isFuture ? 0 : revenue - taxes - acquiring - salaries - rent - expenses

      const acquiringBreakdown: AcquiringBreakdownItem[] = isFuture
        ? []
        : Array.from(acquiringMethodsPerMonth[i]!.values()).map((method) => ({
            methodName: method.name,
            commissionPercent: method.commission,
            paymentSum: Math.round(method.totalPayments),
            fee: Math.round(method.totalPayments * (method.commission / 100)),
          }))

      const rentBreakdown: RentBreakdownItem[] = isFuture
        ? []
        : Array.from(rentLocationsPerMonth[i]!.entries()).map(([locationName, amount]) => ({
            locationName,
            amount: Math.round(amount),
          }))

      const expenseBreakdown: ExpenseBreakdownItem[] = isFuture
        ? []
        : Array.from(expenseNamesPerMonth[i]!.entries()).map(([name, amount]) => ({
            name,
            amount: Math.round(amount),
          }))

      const salariesDetail: SalaryData = {
        total: salaries,
        totalFromLessons: isFuture ? 0 : Math.round(salaryLessonsPerMonth[i]!),
        totalFromPaychecks: isFuture ? 0 : Math.round(salaryPaychecksPerMonth[i]!),
        totalFromManagerFixed: isFuture ? 0 : Math.round(salaryManagerFixedPerMonth[i]!),
        totalFromManagerPaychecks: isFuture ? 0 : Math.round(salaryManagerPaychecksPerMonth[i]!),
        teacherCount: isFuture ? 0 : teacherIdsPerMonth[i]!.size,
        managerCount: isFuture ? 0 : managerIdsPerMonth[i]!.size,
        lessonCount: isFuture ? 0 : lessonCountPerMonth[i]!,
      }

      const taxBreakdown: TaxBreakdown = {
        taxSystem,
        taxSystemLabel,
        incomeTax: isFuture ? 0 : Math.round(incomeTaxPerMonth[i]!),
        incomeTaxRate,
        insuranceContributions: isFuture ? 0 : Math.round(monthlyInsuranceAnnual),
        fixedContributions: isFuture ? 0 : Math.round(monthlyFixedAnnual),
      }

      return {
        monthIndex: i,
        label: MONTH_LABELS_RU[i]!,
        startDate: startDate.toISOString(),
        endDate: monthEnds[i]!.toISOString(),
        revenue,
        taxes,
        acquiring,
        salaries,
        rent,
        expenses,
        profit,
        breakdowns: {
          taxes: taxBreakdown,
          acquiring: acquiringBreakdown,
          salaries: salariesDetail,
          rent: rentBreakdown,
          expenses: expenseBreakdown,
        },
      }
    })

    const totals = months.reduce(
      (acc, m) => ({
        revenue: acc.revenue + m.revenue,
        taxes: acc.taxes + m.taxes,
        acquiring: acc.acquiring + m.acquiring,
        salaries: acc.salaries + m.salaries,
        rent: acc.rent + m.rent,
        expenses: acc.expenses + m.expenses,
        profit: acc.profit + m.profit,
      }),
      {
        revenue: 0,
        taxes: 0,
        acquiring: 0,
        salaries: 0,
        rent: 0,
        expenses: 0,
        profit: 0,
      },
    )

    return {
      year,
      taxSystemLabel,
      months,
      totals,
    }
  })
