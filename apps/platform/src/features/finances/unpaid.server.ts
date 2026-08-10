import { prisma } from '@repo/db'
import type { AttendanceStatus } from '@repo/db/enums'
import { getGroupName } from '@/src/lib/utils'
import { UNPAID_ATTENDANCE_WHERE } from './chargeable.server'

/**
 * Занятия, которые школа провела, а оплаты под них не нашлось.
 *
 * Это не «долг» в рублях: цены у такого занятия нет и не будет, пока не придёт
 * оплата — она его и закроет, по своей цене (см. `ledger.server.ts`). Поэтому
 * единственное, что тут можно показать, — какие именно занятия ждут денег.
 */

export type UnpaidLesson = {
  attendanceId: number
  lessonId: number
  date: string
  time: string
  groupId: number
  groupName: string
  status: AttendanceStatus
  isWarned: boolean | null
}

export async function getUnpaidLessonsOfStudent(
  organizationId: number,
  studentId: number,
): Promise<UnpaidLesson[]> {
  const rows = await prisma.attendance.findMany({
    where: { ...UNPAID_ATTENDANCE_WHERE, organizationId, studentId },
    orderBy: [{ lesson: { date: 'asc' } }, { id: 'asc' }],
    select: {
      id: true,
      status: true,
      isWarned: true,
      lesson: {
        select: {
          id: true,
          date: true,
          time: true,
          group: {
            select: {
              id: true,
              name: true,
              course: { select: { name: true } },
              schedules: { select: { dayOfWeek: true, time: true } },
            },
          },
        },
      },
    },
  })

  return rows.map((r) => ({
    attendanceId: r.id,
    lessonId: r.lesson.id,
    date: r.lesson.date,
    time: r.lesson.time,
    groupId: r.lesson.group.id,
    groupName: getGroupName(r.lesson.group),
    status: r.status,
    isWarned: r.isWarned,
  }))
}

export type UnpaidStudent = {
  studentId: number
  studentName: string
  /** Группа самого раннего неоплаченного занятия — чтобы было куда вести ссылку. */
  groupId: number
  groupName: string
  count: number
  /** Дата самого раннего: чем оно старше, тем хуже. */
  since: string
}

/** Сводка по школе: у кого сколько занятий ждёт оплаты. */
export async function getUnpaidByStudent(organizationId: number): Promise<UnpaidStudent[]> {
  const rows = await prisma.attendance.findMany({
    where: { ...UNPAID_ATTENDANCE_WHERE, organizationId },
    orderBy: [{ lesson: { date: 'asc' } }, { id: 'asc' }],
    select: {
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
      lesson: {
        select: {
          date: true,
          group: {
            select: {
              id: true,
              name: true,
              course: { select: { name: true } },
              schedules: { select: { dayOfWeek: true, time: true } },
            },
          },
        },
      },
    },
  })

  const byStudent = new Map<number, UnpaidStudent>()
  for (const r of rows) {
    const existing = byStudent.get(r.studentId)
    if (existing) {
      existing.count += 1
      continue
    }
    // Строки отсортированы по дате, поэтому первая встреченная — самая ранняя.
    byStudent.set(r.studentId, {
      studentId: r.studentId,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      groupId: r.lesson.group.id,
      groupName: getGroupName(r.lesson.group),
      count: 1,
      since: r.lesson.date,
    })
  }

  return [...byStudent.values()].sort((a, b) => b.count - a.count || a.since.localeCompare(b.since))
}
