'use server'

import { writeLessonsBalanceHistoryTx } from '@/src/lib/lessons-balance'
import prisma from '@/src/lib/prisma'
import { getGroupName, protocol, rootDomain } from '@/src/lib/utils'
import { toZonedTime } from 'date-fns-tz'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Prisma } from '../../prisma/generated/client'
import { AttendanceStatus, StudentLessonsBalanceChangeReason } from '../../prisma/generated/enums'
import { auth } from '../lib/auth'

export type AttendanceWithStudents = Prisma.AttendanceGetPayload<{
  include: {
    student: true
    lesson: {
      include: {
        group: {
          include: {
            course: true
            location: true
            teachers: {
              include: {
                teacher: true
              }
            }
          }
        }
      }
    }
    asMakeupFor: { include: { missedAttendance: { include: { lesson: true } } } }
    missedMakeup: { include: { makeUpAttendance: { include: { lesson: true } } } }
  }
}>

export const createAttendance = async (data: Prisma.AttendanceUncheckedCreateInput) => {
  const attendance = await prisma.attendance.create({ data })
  revalidatePath(`dashboard/lessons/${data.lessonId}`)
  return attendance
}

const updateCoins = async (
  tx: Prisma.TransactionClient,
  newStatus: AttendanceStatus,
  oldStatus: AttendanceStatus,
  studentId: number
) => {
  if (newStatus === AttendanceStatus.PRESENT && oldStatus !== AttendanceStatus.PRESENT) {
    await tx.student.update({
      where: { id: studentId },
      data: { coins: { increment: 10 } },
    })
  } else if (newStatus !== AttendanceStatus.PRESENT && oldStatus === AttendanceStatus.PRESENT) {
    await tx.student.update({
      where: { id: studentId },
      data: { coins: { decrement: 10 } },
    })
  }
}

const isLessonCharged = (status: AttendanceStatus, isWarned: boolean): boolean => {
  if (status === AttendanceStatus.PRESENT) return true
  if (status === AttendanceStatus.ABSENT && !isWarned) return true
  return false
}

const getLessonsBalanceDelta = (
  oldStatus: AttendanceStatus,
  newStatus: AttendanceStatus,
  oldIsWarned: boolean | null,
  newIsWarned: boolean | null
): number => {
  const wasCharged = isLessonCharged(oldStatus, oldIsWarned === true)

  const isCharged = isLessonCharged(newStatus, newIsWarned === true)

  if (wasCharged === isCharged) return 0
  return isCharged ? -1 : +1
}

export const updateAttendance = async (payload: Prisma.AttendanceUpdateArgs) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const status = payload.data.status
  const isWarned = payload.data.isWarned
  const studentId = payload.where.studentId_lessonId?.studentId
  const lessonId = payload.where.studentId_lessonId?.lessonId

  await prisma.$transaction(async (tx) => {
    if (status && studentId && lessonId) {
      const oldAttendance = await tx.attendance.findFirst({
        where: {
          studentId,
          lessonId,
        },
        include: {
          lesson: {
            include: {
              group: {
                include: {
                  course: true,
                  location: true,
                },
              },
            },
          },
          asMakeupFor: true,
        },
      })

      if (oldAttendance && oldAttendance.studentStatus !== 'TRIAL') {
        await updateCoins(
          tx,
          status as AttendanceStatus,
          oldAttendance.status,
          oldAttendance.studentId
        )

        const delta = getLessonsBalanceDelta(
          oldAttendance.status,
          status as AttendanceStatus,
          oldAttendance.isWarned,
          isWarned as boolean | null
        )

        if (delta !== 0) {
          const groupId = oldAttendance.lesson.groupId

          const studentGroup = await tx.studentGroup.findUnique({
            where: { studentId_groupId: { studentId: oldAttendance.studentId, groupId } },
            select: { lessonsBalance: true },
          })
          if (!studentGroup) throw new Error('Ученик не найден в группе')

          const balanceBefore = studentGroup.lessonsBalance
          const updated = await tx.studentGroup.update({
            where: { studentId_groupId: { studentId: oldAttendance.studentId, groupId } },
            data: {
              lessonsBalance: delta > 0 ? { increment: delta } : { decrement: Math.abs(delta) },
            },
            select: { lessonsBalance: true },
          })

          const balanceAfter = updated.lessonsBalance
          const isMakeupAttendance = Boolean(oldAttendance.asMakeupFor)

          const reason = (() => {
            if (delta >= 0) return StudentLessonsBalanceChangeReason.ATTENDANCE_REVERTED

            // delta < 0 => списание 1 урока
            if (isMakeupAttendance) {
              return StudentLessonsBalanceChangeReason.MAKEUP_ATTENDED_CHARGED
            }

            if (status === AttendanceStatus.PRESENT) {
              return StudentLessonsBalanceChangeReason.ATTENDANCE_PRESENT_CHARGED
            }

            return StudentLessonsBalanceChangeReason.ATTENDANCE_ABSENT_CHARGED
          })()

          const lessonName =
            getGroupName(oldAttendance.lesson.group) +
            ` ${toZonedTime(oldAttendance.lesson.date, 'Europe/Moscow').toLocaleDateString('ru-RU')}`

          await writeLessonsBalanceHistoryTx(tx, {
            organizationId: session.organizationId!,
            studentId: oldAttendance.studentId,
            actorUserId: Number(session.user.id),
            groupId,
            reason,
            delta: balanceAfter - balanceBefore,
            balanceBefore,
            balanceAfter,
            meta: {
              attendanceId: oldAttendance.id,
              lessonId: oldAttendance.lessonId,
              lessonName,
              groupId,

              oldStatus: oldAttendance.status,
              newStatus: status,
              oldIsWarned: oldAttendance.isWarned,
              newIsWarned: isWarned,
              isMakeupAttendance,
            },
          })
        }
      }
    }

    await tx.attendance.update(payload)
  })
  revalidatePath(`/dashboard/lessons/${payload.where.studentId_lessonId?.lessonId}`)
}

export const updateAttendanceComment = async (payload: Prisma.AttendanceUpdateArgs) => {
  await prisma.attendance.update(payload)
}

export const updateDataMock = async (time: number) => {
  await new Promise((resolve) => setTimeout(resolve, time))
}

export const deleteAttendance = async (data: Prisma.AttendanceDeleteArgs) => {
  await prisma.attendance.delete(data)

  revalidatePath(`/dashboard/lessons/${data.where.lessonId}`)
}

export const getAbsentStatistics = async (organizationId: number) => {
  const absences = await prisma.attendance.findMany({
    where: {
      organizationId,
      status: 'ABSENT',
    },
    include: {
      student: { include: { groups: true } },
      lesson: true,
      missedMakeup: {
        include: {
          makeUpAttendance: true,
        },
      },
    },
    orderBy: {
      lesson: {
        date: 'asc',
      },
    },
  })

  console.log(absences)

  function getPerGroupRate(
    studentGroups: { groupId: number; totalPayments: number; totalLessons: number }[],
    groupId: number
  ): number {
    const sg = studentGroups.find((g) => g.groupId === groupId)
    if (!sg || sg.totalLessons === 0) return 0
    return sg.totalPayments / sg.totalLessons
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

  // Aggregation
  const monthlyStatsMap = new Map<
    string,
    { missed: number; saved: number; missedMoney: number; savedMoney: number; timestamp: number }
  >()
  const weeklyStatsMap = new Map<
    string,
    { missed: number; saved: number; missedMoney: number; savedMoney: number; timestamp: number }
  >()

  absences.forEach((att) => {
    const date = toZonedTime(new Date(att.lesson.date), 'Europe/Moscow')
    const rate = getPerGroupRate(att.student.groups, att.lesson.groupId)

    // Monthly Grouping
    // Key: YYYY-MM
    const y = date.getFullYear()
    const m = date.getMonth()
    const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`

    // Weekly Grouping
    // Get Monday of the week
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    const monday = new Date(d.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    const weekKey = monday.toISOString().split('T')[0] // YYYY-MM-DD

    // Check saved status
    let isSaved = false
    if (att.missedMakeup?.makeUpAttendance?.status === 'PRESENT') {
      isSaved = true
    }

    // Update Monthly
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

    // Update Weekly
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

  // Format and Sort Monthly
  const monthly = Array.from(monthlyStatsMap.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .map(([key, val]) => {
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

  // Format and Sort Weekly
  const weekly = Array.from(weeklyStatsMap.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .map(([key, val]) => {
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
    totalSaved: absences.filter((a) => a.missedMakeup?.makeUpAttendance?.status === 'PRESENT')
      .length,
    makeupRate:
      absences.length > 0
        ? Math.round(
            (absences.filter((a) => a.missedMakeup?.makeUpAttendance?.status === 'PRESENT').length /
              absences.length) *
              1000
          ) / 10
        : 0,
    totalLostMoney: Math.round(monthly.reduce((s, m) => s + m.missedMoney - m.savedMoney, 0)),
    totalSavedMoney: Math.round(monthly.reduce((s, m) => s + m.savedMoney, 0)),
  }
}
