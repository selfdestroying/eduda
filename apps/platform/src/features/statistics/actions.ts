'use server'

import { prisma } from '@repo/db'
import { authAction } from '@/src/lib/safe-action'
import { nowInTz } from '@/src/lib/timezone'

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
