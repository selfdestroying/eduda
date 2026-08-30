'use server'

import {
  TAX_SYSTEM_CONFIG_SCHEMAS,
  TAX_SYSTEMS,
  type TaxSystemKey,
  type UsnIncomeConfig,
} from '@/src/features/organization/tax-systems/schemas'
import { prisma } from '@repo/db'
import { ForbiddenError } from '@/src/lib/error'
import { featureAction } from '@/src/lib/safe-action'
import { nowInTz, todayYmdInTz } from '@/src/lib/timezone'
import { DEFAULT_CHARGEABLE_STATUSES } from '../chargeable'
import { computeAttendanceRevenue } from '../chargeable.server'
import { allocateRentByMonth, monthIdxOf, monthOf } from './months'
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

/**
 * Прибыль школы целиком — отчёт владельца. Гейт продублирован намеренно: боковое
 * меню прячет раздел, прокси закрывает маршрут при выключенной фиче, но экшен
 * зовётся и напрямую, и без этой проверки преподаватель прочитал бы выручку школы,
 * зарплаты коллег, аренду и все расходы.
 */
const profitAction = featureAction('finances.profit').use(async ({ next, ctx }) => {
  if (ctx.session.memberRole !== 'owner') {
    throw new ForbiddenError('Прибыль доступна только владельцу')
  }
  return next()
})

export const getProfitMonthlyData = profitAction
  .metadata({ actionName: 'getProfitMonthlyData' })
  .inputSchema(ProfitMonthlyFiltersSchema)
  .action(async ({ ctx, parsedInput }): Promise<ProfitMonthlyData> => {
    const { year } = parsedInput
    const organizationId = ctx.session.organizationId!

    // Границы года как date-only строки для фильтров по строковым колонкам дат.
    const yearStartYmd = `${year}-01-01`
    const yearEndYmd = `${year}-12-31`
    const todayYmd = todayYmdInTz(ctx.tz)

    // Init per-month accumulators
    const revenuePerMonth = new Array<number>(12).fill(0)
    const acquiringPerMonth = new Array<number>(12).fill(0)
    const salariesPerMonth = new Array<number>(12).fill(0)
    const expensesPerMonth = new Array<number>(12).fill(0)

    // Per-month breakdown accumulators
    const acquiringMethodsPerMonth: Map<
      number,
      { name: string; commission: number; totalPayments: number }
    >[] = Array.from({ length: 12 }, () => new Map())
    const expenseNamesPerMonth: Map<string, number>[] = Array.from({ length: 12 }, () => new Map())
    const salaryLessonsPerMonth = new Array<number>(12).fill(0)
    const salaryPaychecksPerMonth = new Array<number>(12).fill(0)
    const salaryManagerFixedPerMonth = new Array<number>(12).fill(0)
    const salaryManagerPaychecksPerMonth = new Array<number>(12).fill(0)
    const teacherIdsPerMonth: Set<number>[] = Array.from({ length: 12 }, () => new Set())
    const managerIdsPerMonth: Set<number>[] = Array.from({ length: 12 }, () => new Set())
    const lessonCountPerMonth = new Array<number>(12).fill(0)

    // ── 0. Все выборки независимы — берём их одним заходом ──────────────────
    // Последовательно это девять round-trip'ов до отдельного хоста БД, и ждёт
    // пользователь их сумму, хотя ни одна не зависит от предыдущей.
    const [
      revenueEntries,
      payments,
      lessons,
      paychecks,
      members,
      managerSalaries,
      rents,
      expensesRaw,
      taxConfig,
    ] = await Promise.all([
      // 1. Revenue (per attendance/lesson date)
      computeAttendanceRevenue({
        organizationId,
        startDate: yearStartYmd,
        endDate: yearEndYmd,
        chargeableStatuses: [...DEFAULT_CHARGEABLE_STATUSES],
      }),
      // 2. Acquiring (per payment.date)
      prisma.payment.findMany({
        where: {
          organizationId,
          status: 'ACTIVE',
          date: { gte: yearStartYmd, lte: yearEndYmd },
        },
        select: {
          date: true,
          price: true,
          paymentMethod: {
            select: { id: true, name: true, commission: true },
          },
        },
      }),
      // 3. Уроки преподавателей — только уже проведённые. Занятие, до которого
      // ещё не дошёл календарь, никто не отработал и не оплатил; без этой
      // границы текущий месяц нёс бы зарплату за весь остаток месяца против
      // выручки только по прошедшим дням и всегда выглядел бы убыточным.
      prisma.lesson.findMany({
        where: {
          organizationId,
          date: {
            gte: yearStartYmd,
            lte: todayYmd < yearEndYmd ? todayYmd : yearEndYmd,
          },
          status: 'ACTIVE',
        },
        select: {
          date: true,
          teachers: {
            select: { bid: true, bonusPerStudent: true, teacherId: true },
          },
          _count: { select: { attendance: { where: { status: 'PRESENT' } } } },
        },
      }),
      // 4. Чеки — разовые выплаты, заведённые руками: доплата за интенсив, за
      // индивидуальное занятие, компенсация. Это работа мимо ставок за уроки,
      // поэтому затрата настоящая.
      //
      // По типу не отбираем. Тип спрашивают только при редактировании, так что в
      // данных он почти везде дефолтный `SALARY` и не значит ничего: отбор по нему
      // выбросил бы как раз эти доплаты. Отсюда же известное допущение — премию
      // менеджеру не отличить от выдачи его же оклада, и заведённый ему
      // плюс-чек «Зарплата» посчитается вторым разом поверх `ManagerSalary`.
      //
      // Отрицательный чек — не затрата, а отметка, что часть зарплаты уже выдана
      // на руки (наличными от ученика; минусом уменьшают сумму к переводу на
      // карту). Работа при этом оплачена полностью, и её стоимость уже посчитана
      // выше по урокам. Учесть минус ещё раз — занизить затраты.
      prisma.payCheck.findMany({
        where: {
          organizationId,
          date: { gte: yearStartYmd, lte: yearEndYmd },
          amount: { gt: 0 },
        },
        select: { date: true, amount: true, userId: true },
      }),
      prisma.member.findMany({
        where: { organizationId },
        select: { userId: true, role: true },
      }),
      prisma.managerSalary.findMany({
        where: { organizationId },
        orderBy: { startDate: 'desc' },
      }),
      // 5. Аренда, пересекающаяся с годом
      prisma.rent.findMany({
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
          location: { select: { name: true } },
        },
      }),
      // 6. Прочие расходы (per expense.date)
      prisma.expense.findMany({
        where: {
          organizationId,
          date: { gte: yearStartYmd, lte: yearEndYmd },
        },
        select: { date: true, name: true, amount: true },
      }),
      prisma.taxConfig.findUnique({ where: { organizationId } }),
    ])

    for (const e of revenueEntries) {
      revenuePerMonth[monthOf(e.lessonDate)]! += e.visitCost
    }

    for (const p of payments) {
      if (!p.paymentMethod) continue
      const m = monthOf(p.date)
      acquiringPerMonth[m]! += p.price * (p.paymentMethod.commission / 100)
      const bucket = acquiringMethodsPerMonth[m]!
      const { id, name, commission } = p.paymentMethod
      const existing = bucket.get(id)
      if (existing) existing.totalPayments += p.price
      else bucket.set(id, { name, commission, totalPayments: p.price })
    }

    for (const lesson of lessons) {
      const m = monthOf(lesson.date)
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

    const managerUserIds = new Set(
      members.filter((m) => m.role === 'manager' || m.role === 'owner').map((m) => m.userId),
    )
    for (const p of paychecks) {
      const m = monthOf(p.date)
      salariesPerMonth[m]! += p.amount
      // Преподаватель или менеджер — по роли в организации, а не по типу чека:
      // тип почти везде дефолтный, и раньше условие `type === 'BONUS'` уводило
      // все чеки менеджеров в корзину «Начисления преподавателям».
      if (managerUserIds.has(p.userId)) {
        salaryManagerPaychecksPerMonth[m]! += p.amount
        managerIdsPerMonth[m]!.add(p.userId)
      } else {
        salaryPaychecksPerMonth[m]! += p.amount
      }
    }

    // Manager fixed salaries per month (whole-month with supersession)
    const managerSalariesByUser = new Map<number, typeof managerSalaries>()
    for (const s of managerSalaries) {
      const arr = managerSalariesByUser.get(s.userId) ?? []
      arr.push(s)
      managerSalariesByUser.set(s.userId, arr)
    }
    for (const [userId, rows] of managerSalariesByUser) {
      for (let m = 0; m < 12; m++) {
        const monthIdx = year * 12 + m
        const applicable = rows.find(
          (s) =>
            monthIdxOf(s.startDate) <= monthIdx &&
            (s.endDate === null || monthIdxOf(s.endDate) >= monthIdx),
        )
        if (applicable) {
          salariesPerMonth[m]! += applicable.monthlyAmount
          salaryManagerFixedPerMonth[m]! += applicable.monthlyAmount
          managerIdsPerMonth[m]!.add(userId)
        }
      }
    }

    const { perMonth: rentPerMonth, byLocation: rentLocationsPerMonth } = allocateRentByMonth(
      rents,
      year,
    )

    for (const e of expensesRaw) {
      const m = monthOf(e.date)
      expensesPerMonth[m]! += e.amount
      const bucket = expenseNamesPerMonth[m]!
      bucket.set(e.name, (bucket.get(e.name) ?? 0) + e.amount)
    }

    // ── Налоги (USN_INCOME): годовые взносы размазаны по месяцам ────────────
    const taxSystem = (taxConfig?.taxSystem ?? 'USN_INCOME') as TaxSystemKey
    const taxSystemMeta = TAX_SYSTEMS.find((s) => s.value === taxSystem)
    const taxSystemLabel = taxSystemMeta?.label ?? taxSystem
    // Считать умеем пока только УСН «Доходы». Для остальных отдаём признак, а не
    // молчаливый ноль: ноль неотличим от «налогов нет» и завышает прибыль ровно
    // на всю их сумму.
    const taxSupported = taxSystem === 'USN_INCOME'

    const taxesPerMonth = new Array<number>(12).fill(0)
    const incomeTaxPerMonth = new Array<number>(12).fill(0)
    let monthlyInsuranceAnnual = 0
    let monthlyFixedAnnual = 0
    let incomeTaxRate = 0

    if (taxSupported) {
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

    // ── Build response ──────────────────────────────────────────────────────
    // Future months (past the current month in the current year) show zeros.
    const now = nowInTz(ctx.tz)
    const isCurrentYear = now.getFullYear() === year
    const currentMonthIndex = now.getMonth()

    const months: ProfitMonthEntry[] = Array.from({ length: 12 }, (_, i) => {
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
      taxSupported,
      months,
      totals,
    }
  })
