'use server'

import { prisma } from '@repo/db'
import { authAction } from '@/src/lib/safe-action'
import { ymdToLocalDate } from '@/src/lib/timezone'
import { CLASSIFICATION_LABELS, classifyAttendance } from '../chargeable'
import { RevenueFiltersSchema } from './schemas'
import { formatCurrency } from '@/src/lib/utils'
import type {
  AttendanceWithCost,
  DayGroup,
  LessonWithCost,
  RevenueData,
  RevenueStats,
} from './types'

export const getRevenueData = authAction
  .metadata({ actionName: 'getRevenueData' })
  .inputSchema(RevenueFiltersSchema)
  .action(async ({ ctx, parsedInput }): Promise<RevenueData> => {
    const { startDate, endDate, courseIds, locationIds, teacherIds, chargeableStatuses } =
      parsedInput
    const organizationId = ctx.session.organizationId!

    // Build dynamic group filter
    const groupFilter: Record<string, object> = {}
    if (courseIds && courseIds.length > 0) {
      groupFilter.courseId = { in: courseIds }
    }
    if (locationIds && locationIds.length > 0) {
      groupFilter.locationId = { in: locationIds }
    }

    // Build teacher filter
    const teacherFilter =
      teacherIds && teacherIds.length > 0 ? { some: { teacherId: { in: teacherIds } } } : undefined

    const lessons = await prisma.lesson.findMany({
      where: {
        organizationId,
        date: { gte: startDate, lte: endDate },
        group: Object.keys(groupFilter).length > 0 ? groupFilter : undefined,
        teachers: teacherFilter,
      },
      select: {
        id: true,
        date: true,
        time: true,
        status: true,
        group: {
          select: {
            id: true,
            course: { select: { name: true } },
            location: { select: { name: true } },
            groupType: { select: { name: true } },
            schedules: { select: { dayOfWeek: true, time: true } },
            teachers: { select: { teacher: { select: { name: true } } } },
          },
        },
        attendance: {
          select: {
            makeupAttendance: {
              select: {
                status: true,
                lesson: {
                  select: {
                    date: true,
                    group: { select: { course: { select: { name: true } } } },
                  },
                },
              },
            },
            makeupForAttendanceId: true,
            isWarned: true,
            status: true,
            isTrial: true,
            price: true,
            amount: true,
            payment: { select: { date: true, price: true, lessonCount: true } },
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                wallets: {
                  select: {
                    id: true,
                    name: true,
                    lessonsBalance: true,
                    totalLessons: true,
                    totalPayments: true,
                    studentGroups: { select: { groupId: true, studentId: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    })

    // --- Compute stats ---
    const totalLessons = lessons.length
    let doneLessons = 0
    let presentCount = 0
    let totalStudentVisits = 0
    let totalRevenue = 0
    let chargedVisits = 0

    // --- Compute per-lesson cost + build day groups ---
    const dayMap: Record<string, DayGroup> = {}

    for (const lesson of lessons) {
      const isActive = lesson.status === 'ACTIVE'
      if (isActive) doneLessons++

      const attendanceWithCost: AttendanceWithCost[] = lesson.attendance.map((att) => {
        const wallet = att.student.wallets.find((w) =>
          w.studentGroups.some((sg) => sg.groupId === lesson.group.id),
        )

        // Отработка зарабатывает на своей дате, поэтому в списке она отдельной
        // строкой; у исходного пропуска денег нет — там стоит amount 0. Класс у неё
        // тот же, что и в отчётах (`chargeable.server.ts`), иначе снятая галка
        // фильтра развела бы страницу «Выручка» и «Прибыль» по разным суммам.
        const classification = att.makeupForAttendanceId
          ? 'makeup_success'
          : (classifyAttendance(att) ?? null)
        const label = classification ? CLASSIFICATION_LABELS[classification] : 'Статус не определён'
        const counted =
          att.amount !== null &&
          att.amount > 0 &&
          (classification === null || chargeableStatuses.includes(classification))

        const visitCost = counted ? (att.price ?? 0) * att.amount! : 0

        const costReason = (() => {
          if (lesson.status === 'CANCELLED') return 'Урок отменён — стоимость не списывается'
          if (att.isTrial) return 'Пробное занятие — с баланса не списывается'
          if (att.amount === null) return `${label} → не размечено, оплата не найдена`
          if (!counted && att.makeupAttendance) {
            return `${label} → деньги на строке отработки ${att.makeupAttendance.lesson.date}`
          }
          // Занятие провели, платить за него надо, а пакета под него не нашлось.
          // Цену не выдумываем — она появится вместе с оплатой.
          if (
            att.amount === 0 &&
            att.price === null &&
            classification !== null &&
            ['present', 'absent_no_warn', 'makeup_success'].includes(classification)
          ) {
            return `${label} → не оплачено: оплаты под это занятие ещё нет`
          }
          if (!counted) return `${label} → не списано`
          if (att.payment) {
            return `${label} → списано\nпакет от ${att.payment.date}: ${formatCurrency(att.payment.price)} / ${att.payment.lessonCount} ур. = ${formatCurrency(visitCost)}`
          }
          return `${label} → списано в долг\nоплаты под этот урок в базе нет, взята последняя цена кошелька: ${formatCurrency(visitCost)}`
        })()

        // Stats accumulation (only for active lessons)
        if (isActive) {
          totalStudentVisits++
          if (visitCost > 0) {
            presentCount++
            totalRevenue += visitCost
            chargedVisits++
          }
        }

        return {
          status: att.status,
          isWarned: att.isWarned,
          isTrial: att.isTrial,
          visitCost,
          costReason,
          student: {
            id: att.student.id,
            firstName: att.student.firstName,
            lastName: att.student.lastName,
          },
          wallet: wallet
            ? {
                id: wallet.id,
                name: wallet.name,
                lessonsBalance: wallet.lessonsBalance,
                totalLessons: wallet.totalLessons,
                totalPayments: wallet.totalPayments,
              }
            : null,
          makeupAttendance: att.makeupAttendance
            ? {
                status: att.makeupAttendance.status,
                lesson: att.makeupAttendance.lesson,
              }
            : null,
        }
      })

      const dayOfWeek = ymdToLocalDate(lesson.date).toLocaleDateString('ru-RU', { weekday: 'long' })
      const dateKey = lesson.date

      const lessonWithCost: LessonWithCost = {
        id: lesson.id,
        date: lesson.date,
        time: lesson.time,
        status: lesson.status,
        dayOfWeek,
        group: lesson.group,
        attendance: attendanceWithCost,
      }

      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {
          date: lesson.date,
          dayOfWeek,
          dayRevenue: 0,
          lessons: [],
        }
      }
      dayMap[dateKey].lessons.push(lessonWithCost)
      dayMap[dateKey].dayRevenue += attendanceWithCost.reduce((s, a) => s + a.visitCost, 0)
    }

    const attendanceRate =
      totalStudentVisits > 0 ? Math.round((presentCount / totalStudentVisits) * 100) : 0
    const avgPerVisit = chargedVisits > 0 ? totalRevenue / chargedVisits : 0
    const avgPerLesson = doneLessons > 0 ? totalRevenue / doneLessons : 0

    const stats: RevenueStats = {
      totalLessons,
      doneLessons,
      presentCount,
      totalStudentVisits,
      attendanceRate,
      totalRevenue,
      chargedVisits,
      avgPerVisit,
      avgPerLesson,
    }

    const days = Object.values(dayMap).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    return { stats, days }
  })
