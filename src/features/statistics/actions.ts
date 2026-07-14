'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { nowInTz, toTz } from '@/src/lib/timezone'

// ─── ACTIVE STATISTICS ───────────────────────────────────────────────────────

export const getActiveStudentStatistics = authAction
  .metadata({ actionName: 'getActiveStudentStatistics' })
  .action(async ({ ctx }) => {
    const organizationId = ctx.session.organizationId!

    const activeStudentGroups = await prisma.studentGroup.findMany({
      where: { organizationId, status: { in: ['ACTIVE', 'TRIAL'] } },
      include: {
        group: {
          include: {
            course: true,
            location: true,
            teachers: {
              include: {
                teacher: true,
              },
            },
          },
        },
        student: true,
      },
      orderBy: {
        student: {
          createdAt: 'asc',
        },
      },
    })

    const uniqueStudentsMap = new Map<number, (typeof activeStudentGroups)[0]['student']>()
    activeStudentGroups.forEach((sg) => {
      uniqueStudentsMap.set(sg.student.id, sg.student)
    })

    const totalStudents = uniqueStudentsMap.size

    const monthlyStatsMap = new Map<string, { count: number; timestamp: number }>()
    uniqueStudentsMap.forEach((student) => {
      const date = toTz(student.createdAt, ctx.tz)
      const y = date.getFullYear()
      const m = date.getMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      const existing = monthlyStatsMap.get(key)
      if (existing) {
        existing.count++
      } else {
        monthlyStatsMap.set(key, { count: 1, timestamp: new Date(y, m, 1).getTime() })
      }
    })

    const monthly = Array.from(monthlyStatsMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([, val]) => {
        const d = new Date(val.timestamp)
        return {
          month: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
          count: val.count,
        }
      })

    const now = nowInTz(ctx.tz)
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const newThisMonth = monthlyStatsMap.get(thisMonthKey)?.count ?? 0
    const newPrevMonth = monthlyStatsMap.get(prevMonthKey)?.count ?? 0
    const growthPercent =
      newPrevMonth > 0 ? Math.round(((newThisMonth - newPrevMonth) / newPrevMonth) * 100) : 0

    const locationStats: Record<string, Set<number>> = {}
    activeStudentGroups.forEach((sg) => {
      const locName = sg.group.location?.name || 'Не указано'
      if (!locationStats[locName]) locationStats[locName] = new Set()
      locationStats[locName].add(sg.studentId)
    })
    const locations = Object.entries(locationStats)
      .map(([name, s]) => ({ name, count: s.size }))
      .sort((a, b) => b.count - a.count)

    const teacherStats: Record<string, Set<number>> = {}
    activeStudentGroups.forEach((sg) => {
      sg.group.teachers.forEach((tg) => {
        const teacherName = tg.teacher.name
        if (!teacherStats[teacherName]) teacherStats[teacherName] = new Set()
        teacherStats[teacherName].add(sg.studentId)
      })
    })
    const teachers = Object.entries(teacherStats)
      .map(([name, s]) => ({ name, count: s.size }))
      .sort((a, b) => b.count - a.count)

    const courseStats: Record<string, Set<number>> = {}
    activeStudentGroups.forEach((sg) => {
      const courseName = sg.group.course.name
      if (!courseStats[courseName]) courseStats[courseName] = new Set()
      courseStats[courseName].add(sg.studentId)
    })
    const courses = Object.entries(courseStats)
      .map(([name, s]) => ({ name, count: s.size }))
      .sort((a, b) => b.count - a.count)

    const totalGroups = new Set(activeStudentGroups.map((sg) => sg.groupId)).size
    const avgPerGroup = totalGroups > 0 ? Math.round((totalStudents / totalGroups) * 10) / 10 : 0

    return {
      totalStudents,
      newThisMonth,
      newPrevMonth,
      growthPercent,
      totalGroups,
      avgPerGroup,
      monthly,
      locations,
      teachers,
      courses,
    }
  })

// ─── DISMISSED STATISTICS ────────────────────────────────────────────────────

export const getDismissedStatistics = authAction
  .metadata({ actionName: 'getDismissedStatistics' })
  .action(async ({ ctx }) => {
    const organizationId = ctx.session.organizationId!

    const [dismissed, allGroups, activeCount] = await Promise.all([
      prisma.studentGroup.findMany({
        where: { organizationId, status: 'DISMISSED' },
        include: {
          group: {
            include: {
              course: true,
              location: true,
              teachers: { include: { teacher: true } },
            },
          },
          student: true,
        },
        orderBy: { statusChangedAt: 'asc' },
      }),
      prisma.teacherGroup.findMany({
        where: { organizationId },
        include: {
          group: {
            select: {
              _count: { select: { students: { where: { status: { in: ['ACTIVE', 'TRIAL'] } } } } },
            },
          },
          teacher: true,
        },
        orderBy: { teacher: { id: 'asc' } },
      }),
      prisma.studentGroup.count({ where: { organizationId, status: { in: ['ACTIVE', 'TRIAL'] } } }),
    ])

    const totalDismissed = dismissed.length
    const churnRate =
      activeCount + totalDismissed > 0
        ? Math.round((totalDismissed / (activeCount + totalDismissed)) * 1000) / 10
        : 0

    const monthlyStatsMap = new Map<string, { count: number; timestamp: number }>()
    dismissed.forEach((item) => {
      const date = item.statusChangedAt ? new Date(item.statusChangedAt) : new Date(item.updatedAt)
      const y = date.getUTCFullYear()
      const m = date.getUTCMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      const existing = monthlyStatsMap.get(key)
      if (existing) {
        existing.count++
      } else {
        monthlyStatsMap.set(key, { count: 1, timestamp: Date.UTC(y, m, 1) })
      }
    })

    const monthly = Array.from(monthlyStatsMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([, val]) => {
        const d = new Date(val.timestamp)
        return {
          month: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
          count: val.count,
        }
      })

    const now = nowInTz(ctx.tz)
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const thisMonthCount = monthlyStatsMap.get(thisMonthKey)?.count ?? 0
    const prevMonthCount = monthlyStatsMap.get(prevMonthKey)?.count ?? 0

    const teacherStudentCounts: Record<string, number> = {}
    allGroups.forEach((tg) => {
      const name = tg.teacher.name
      teacherStudentCounts[name] = (teacherStudentCounts[name] || 0) + tg.group._count.students
    })

    const dismissedByTeacher: Record<string, number> = {}
    dismissed.forEach((item) => {
      item.group.teachers.forEach((tg) => {
        const name = tg.teacher.name
        dismissedByTeacher[name] = (dismissedByTeacher[name] || 0) + 1
      })
    })

    const teachers = Object.entries(dismissedByTeacher)
      .map(([teacherName, count]) => {
        const totalStudents = teacherStudentCounts[teacherName] || 0
        const percentage = totalStudents > 0 ? (count / (totalStudents + count)) * 100 : 0
        return {
          teacherName,
          dismissedCount: count,
          totalStudents,
          percentage: Math.round(percentage * 100) / 100,
        }
      })
      .sort((a, b) => b.percentage - a.percentage)

    const courseStats = dismissed.reduce(
      (acc, item) => {
        const name = item.group.course.name
        acc[name] = (acc[name] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const locationStats = dismissed.reduce(
      (acc, item) => {
        const name = item.group.location?.name || 'Не указано'
        acc[name] = (acc[name] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const topCourse = Object.entries(courseStats).sort((a, b) => b[1] - a[1])[0]

    return {
      totalDismissed,
      churnRate,
      thisMonthCount,
      prevMonthCount,
      topCourseName: topCourse?.[0] ?? '-',
      topCourseCount: topCourse?.[1] ?? 0,
      monthly,
      teachers,
      courses: Object.entries(courseStats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      locations: Object.entries(locationStats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    }
  })

// ─── ABSENT STATISTICS ──────────────────────────────────────────────────────

export const getAbsentStatistics = authAction
  .metadata({ actionName: 'getAbsentStatistics' })
  .action(async ({ ctx }) => {
    const organizationId = ctx.session.organizationId!

    const absences = await prisma.attendance.findMany({
      where: {
        organizationId,
        status: 'ABSENT',
      },
      include: {
        student: {
          include: {
            groups: {
              where: { status: { in: ['ACTIVE', 'TRIAL'] } },
              include: { wallet: true },
            },
          },
        },
        lesson: true,
        makeupAttendance: true,
      },
      orderBy: {
        lesson: {
          date: 'asc',
        },
      },
    })

    function getPerGroupRate(
      studentGroups: {
        groupId: number
        wallet: { totalPayments: number; totalLessons: number } | null
      }[],
      groupId: number,
    ): number {
      const sg = studentGroups.find((g) => g.groupId === groupId)
      if (!sg?.wallet || sg.wallet.totalLessons === 0) return 0
      return sg.wallet.totalPayments / sg.wallet.totalLessons
    }

    let rateSum = 0
    let rateCount = 0
    absences.forEach((att) => {
      const rate = getPerGroupRate(att.student.groups, att.lesson.groupId)
      if (rate > 0) {
        rateSum += rate
        rateCount++
      }
    })
    const averagePrice = rateCount > 0 ? Math.round(rateSum / rateCount) : 0

    const monthlyStatsMap = new Map<
      string,
      { missed: number; saved: number; missedMoney: number; savedMoney: number; timestamp: number }
    >()
    const weeklyStatsMap = new Map<
      string,
      { missed: number; saved: number; missedMoney: number; savedMoney: number; timestamp: number }
    >()

    absences.forEach((att) => {
      const date = new Date(att.lesson.date)
      const rate = getPerGroupRate(att.student.groups, att.lesson.groupId)

      const y = date.getUTCFullYear()
      const m = date.getUTCMonth()
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`

      const day = date.getUTCDay()
      const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(Date.UTC(y, m, diff))
      const weekKey = monday.toISOString().split('T')[0]!

      let isSaved = false
      if (att.makeupAttendance?.status === 'PRESENT') {
        isSaved = true
      }

      if (!monthlyStatsMap.has(monthKey)) {
        monthlyStatsMap.set(monthKey, {
          missed: 0,
          saved: 0,
          missedMoney: 0,
          savedMoney: 0,
          timestamp: new Date(y, m, 1).getTime(),
        })
      }
      const mStat = monthlyStatsMap.get(monthKey)!
      mStat.missed++
      mStat.missedMoney += rate
      if (isSaved) {
        mStat.saved++
        mStat.savedMoney += rate
      }

      if (!weeklyStatsMap.has(weekKey)) {
        weeklyStatsMap.set(weekKey, {
          missed: 0,
          saved: 0,
          missedMoney: 0,
          savedMoney: 0,
          timestamp: monday.getTime(),
        })
      }
      const wStat = weeklyStatsMap.get(weekKey)!
      wStat.missed++
      wStat.missedMoney += rate
      if (isSaved) {
        wStat.saved++
        wStat.savedMoney += rate
      }
    })

    const monthly = Array.from(monthlyStatsMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([, val]) => {
        const dateRep = new Date(val.timestamp)
        return {
          name: dateRep.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
          missed: val.missed,
          saved: val.saved,
          missedMoney: Math.round(val.missedMoney),
          savedMoney: Math.round(val.savedMoney),
          lossMoney: Math.round(val.missedMoney - val.savedMoney),
        }
      })

    const weekly = Array.from(weeklyStatsMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([, val]) => {
        const dateRep = new Date(val.timestamp)
        return {
          name: dateRep.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
          missed: val.missed,
          saved: val.saved,
          missedMoney: Math.round(val.missedMoney),
          savedMoney: Math.round(val.savedMoney),
          lossMoney: Math.round(val.missedMoney - val.savedMoney),
        }
      })

    return {
      averagePrice,
      monthly,
      weekly,
      totalAbsences: absences.length,
      totalSaved: absences.filter((a) => a.makeupAttendance?.status === 'PRESENT').length,
      makeupRate:
        absences.length > 0
          ? Math.round(
              (absences.filter((a) => a.makeupAttendance?.status === 'PRESENT').length /
                absences.length) *
                1000,
            ) / 10
          : 0,
      totalLostMoney: Math.round(monthly.reduce((s, m) => s + m.missedMoney - m.savedMoney, 0)),
      totalSavedMoney: Math.round(monthly.reduce((s, m) => s + m.savedMoney, 0)),
    }
  })
