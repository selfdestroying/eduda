'use server'

import prisma from '@/src/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Prisma } from '../../prisma/generated/client'

export type DismissedWithStudentAndGroup = Prisma.DismissedGetPayload<{
  include: {
    student: true
    group: {
      include: {
        course: true
        location: true
        teachers: { include: { teacher: { include: { members: true } } } }
      }
    }
  }
}>

export async function getDismissed(payload: Prisma.DismissedFindFirstArgs) {
  const dismissed = await prisma.dismissed.findMany(payload)
  return dismissed
}

export async function createDismissed(payload: Prisma.DismissedCreateArgs) {
  await prisma.dismissed.create(payload)
  revalidatePath(`/dashboard/groups/${payload.data.groupId}`)
}

export async function removeDismissed(payload: Prisma.DismissedDeleteArgs) {
  await prisma.dismissed.delete(payload)
  revalidatePath('/dashboard/dismissed')
}

export async function returnToGroup(payload: {
  dismissedId: number
  groupId: number
  studentId: number
  organizationId: number
}) {
  const { dismissedId, groupId, studentId } = payload
  await prisma.$transaction(async (tx) => {
    await tx.dismissed.delete({ where: { id: dismissedId } })
    const lastAttendance = await tx.attendance.findFirst({
      where: {
        studentId,
        lesson: {
          groupId,
        },
      },
      include: {
        lesson: true,
      },
      orderBy: {
        lesson: { date: 'desc' },
      },
    })
    await tx.studentGroup.create({
      data: {
        studentId,
        groupId,
        organizationId: payload.organizationId,
        status: 'ACTIVE',
      },
    })
    if (lastAttendance) {
      const lessons = await tx.lesson.findMany({
        where: {
          organizationId: payload.organizationId,
          groupId,
          date: { gt: lastAttendance.lesson.date },
        },
      })
      for (const lesson of lessons) {
        await tx.attendance.create({
          data: {
            organizationId: lesson.organizationId,
            lessonId: lesson.id,
            studentId,
            status: 'UNSPECIFIED',
            comment: '',
          },
        })
      }
    }
  })

  revalidatePath('/dashboard/dismissed')
}

export async function getDismissedStatistics(organizationId: number) {
  const [dismissed, allGroups, activeCount] = await Promise.all([
    prisma.dismissed.findMany({
      where: { organizationId },
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
      orderBy: { date: 'asc' },
    }),
    prisma.teacherGroup.findMany({
      where: { organizationId },
      include: {
        group: { select: { _count: { select: { students: true } } } },
        teacher: true,
      },
      orderBy: { teacher: { id: 'asc' } },
    }),
    prisma.studentGroup.count({ where: { organizationId } }),
  ])

  const totalDismissed = dismissed.length
  const churnRate =
    activeCount + totalDismissed > 0
      ? Math.round((totalDismissed / (activeCount + totalDismissed)) * 1000) / 10
      : 0

  // Monthly grouping with timestamps for proper sorting
  const monthlyStatsMap = new Map<string, { count: number; timestamp: number }>()
  dismissed.forEach((item) => {
    const date = new Date(item.date)
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

  // KPI: this month vs previous
  const now = new Date()
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const thisMonthCount = monthlyStatsMap.get(thisMonthKey)?.count ?? 0
  const prevMonthCount = monthlyStatsMap.get(prevMonthKey)?.count ?? 0

  // Teacher stats with churn %
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

  // Course stats
  const courseStats = dismissed.reduce(
    (acc, item) => {
      const name = item.group.course.name
      acc[name] = (acc[name] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Location stats
  const locationStats = dismissed.reduce(
    (acc, item) => {
      const name = item.group.location?.name || 'Не указано'
      acc[name] = (acc[name] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Top dismissal reasons (by course pattern)
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
}
