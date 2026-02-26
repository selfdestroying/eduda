'use server'

import prisma from '@/src/lib/prisma'
import { startOfDay } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { revalidatePath } from 'next/cache'
import { Prisma } from '../../prisma/generated/client'

export const getGroups = async <T extends Prisma.GroupFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.GroupFindManyArgs>
) => {
  return await prisma.group.findMany<T>(payload)
}

export const getGroup = async <T extends Prisma.GroupFindFirstArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.GroupFindFirstArgs>
) => {
  return await prisma.group.findFirst(payload)
}

export const createGroup = async (
  payload: Prisma.GroupCreateArgs,
  schedule?: Array<{ dayOfWeek: number; time: string }>
) => {
  await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      ...payload,
      include: {
        teachers: {
          include: { rate: true },
        },
        lessons: { select: { id: true } },
      },
    })
    const firstTeacher = group.teachers[0]
    const lessons = group.lessons.map((l) => ({
      organizationId: group.organizationId,
      lessonId: l.id,
      teacherId: firstTeacher.teacherId,
      bid: firstTeacher.rate.bid,
      bonusPerStudent: firstTeacher.rate.bonusPerStudent,
    }))
    await tx.teacherLesson.createMany({
      data: lessons,
    })
    if (schedule && schedule.length > 0) {
      await tx.groupSchedule.createMany({
        data: schedule.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          time: s.time,
          groupId: group.id,
          organizationId: group.organizationId,
        })),
      })
    }
  })

  revalidatePath('dashboard/groups')
}

export const updateGroup = async (payload: Prisma.GroupUpdateArgs) => {
  await prisma.group.update(payload)
  const dayOfWeek = payload.data.dayOfWeek
  const time = payload.data.time
  if (time != null) {
    await prisma.lesson.updateMany({
      where: { groupId: payload.where.id, date: { gte: startOfDay(new Date()) } },
      data: { time },
    })
  }
  if (dayOfWeek != null) {
    const lessons = await prisma.lesson.findMany({
      where: { groupId: payload.where.id, date: { gte: startOfDay(new Date()) } },
    })

    const nearestWeekDay = startOfDay(new Date())
    const currentDay = nearestWeekDay.getDay()

    let diff = ((dayOfWeek as number) - currentDay + 7) % 7

    if (diff === 0) {
      diff = 7
    }

    nearestWeekDay.setDate(nearestWeekDay.getDate() + diff)
    for (const lesson of lessons) {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { date: fromZonedTime(nearestWeekDay, 'Europe/Moscow') },
      })
      nearestWeekDay.setDate(nearestWeekDay.getDate() + 7)
    }
  }
  revalidatePath(`/dashboard/groups/${payload.where.id}`)
}

export const deleteGroup = async (payload: Prisma.GroupDeleteArgs) => {
  await prisma.group.delete(payload)
  revalidatePath('dashboard/groups')
}

// Student-Group Relations

export const createStudentGroup = async (
  payload: Prisma.StudentGroupCreateArgs,
  isApplyToLessons: boolean
) => {
  await prisma.$transaction(async (tx) => {
    await tx.studentGroup.create(payload)

    if (!isApplyToLessons) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const futureLessons = await tx.lesson.findMany({
      where: {
        groupId: payload.data.groupId,
        date: { gte: today },
      },
      select: { id: true, organizationId: true },
    })

    if (futureLessons.length > 0) {
      const attendanceData = futureLessons.map((lesson) => ({
        organizationId: lesson.organizationId,
        lessonId: lesson.id,
        studentId: payload.data.studentId as number,
        comment: '',
        status: 'UNSPECIFIED' as const,
      }))

      await tx.attendance.createMany({
        data: attendanceData,
        skipDuplicates: true,
      })
    }
  })

  revalidatePath(`/dashboard/groups/${payload.data.groupId}`)
}

export const updateStudentGroup = async (
  payload: Prisma.StudentGroupUpdateArgs,
  isApplyToLessons: boolean
) => {
  await prisma.$transaction(async (tx) => {
    const oldStudentGroup = await tx.studentGroup.findUniqueOrThrow({
      where: payload.where,
      select: { groupId: true, studentId: true },
    })

    const sg = await tx.studentGroup.update(payload)

    if (!isApplyToLessons) return

    const isGroupChanged = oldStudentGroup.groupId !== sg.groupId

    // Удаляем посещаемость из старой группы при переводе
    if (isGroupChanged) {
      await tx.attendance.deleteMany({
        where: {
          studentId: sg.studentId,
          status: 'UNSPECIFIED',
          lesson: {
            groupId: oldStudentGroup.groupId,
          },
        },
      })
    }

    const today = startOfDay(new Date())
    // Создаём посещаемость в новой группе
    const newFutureLessons = await tx.lesson.findMany({
      where: {
        groupId: sg.groupId,
        date: { gte: today },
      },
      select: { id: true, organizationId: true },
    })

    if (newFutureLessons.length > 0) {
      const attendanceData = newFutureLessons.map((lesson) => ({
        organizationId: lesson.organizationId,
        lessonId: lesson.id,
        studentId: sg.studentId,
        comment: '',
        status: 'UNSPECIFIED' as const,
      }))

      await tx.attendance.createMany({
        data: attendanceData,
        skipDuplicates: true,
      })
    }

    if (isGroupChanged) {
      revalidatePath(`/dashboard/groups/${oldStudentGroup.groupId}`)
    }
    revalidatePath(`/dashboard/groups/${sg.groupId}`)
  })
}

export const deleteStudentGroup = async (payload: Prisma.StudentGroupDeleteArgs) => {
  await prisma.$transaction(async (tx) => {
    const studentGroup = await tx.studentGroup.delete(payload)

    // Transfer remaining per-group balance back to unallocated (student-level)
    if (
      studentGroup.lessonsBalance !== 0 ||
      studentGroup.totalLessons !== 0 ||
      studentGroup.totalPayments !== 0
    ) {
      // Remaining group balance is preserved as unallocated on the Student record
      // (Student.lessonsBalance stays unchanged, but the allocated portion decreases)
      // No additional action needed — the unallocated balance auto-increases
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const futureLessons = await tx.lesson.findMany({
      where: {
        groupId: studentGroup.groupId,
        date: { gte: today },
      },
      select: { id: true, organizationId: true },
    })

    if (futureLessons.length > 0) {
      const lessonIds = futureLessons.map((l) => l.id)

      await tx.attendance.deleteMany({
        where: {
          studentId: studentGroup.studentId,
          lessonId: { in: lessonIds },
          status: 'UNSPECIFIED',
        },
      })
    }
    revalidatePath(`/dashboard/groups/${studentGroup.groupId}`)
  })
}

export const updateTeacherGroup = async (
  payload: Prisma.TeacherGroupUpdateArgs,
  isApplyToLessons: boolean
) => {
  await prisma.$transaction(async (tx) => {
    const teacherGroup = await tx.teacherGroup.update({
      ...payload,
      include: { rate: true },
    })

    if (isApplyToLessons) {
      await tx.teacherLesson.updateMany({
        where: {
          teacherId: teacherGroup.teacherId,
          lesson: {
            date: { gt: new Date() },
            groupId: teacherGroup.groupId,
          },
        },
        data: {
          bid: teacherGroup.rate.bid,
          bonusPerStudent: teacherGroup.rate.bonusPerStudent,
        },
      })
    }
  })

  revalidatePath(`/dashboard/groups/${payload.data.groupId}`)
}

export const createTeacherGroup = async (
  payload: Prisma.TeacherGroupCreateArgs,
  isApplyToLessons: boolean
) => {
  await prisma.$transaction(async (tx) => {
    const teacherGroup = await tx.teacherGroup.create({
      ...payload,
      include: {
        rate: true,
        group: {
          include: {
            lessons: {
              where: {
                date: { gt: new Date() },
                teachers: { none: { teacherId: payload.data.teacherId } },
              },
            },
          },
        },
      },
    })
    if (isApplyToLessons) {
      for (const lesson of teacherGroup.group.lessons) {
        await tx.teacherLesson.create({
          data: {
            organizationId: lesson.organizationId,
            lessonId: lesson.id,
            teacherId: payload.data.teacherId as number,
            bid: teacherGroup.rate.bid,
            bonusPerStudent: teacherGroup.rate.bonusPerStudent,
          },
        })
      }
    }
  })
  revalidatePath(`/dashboard/groups/${payload.data.groupId}`)
}

export const deleteTeacherGroup = async (
  payload: Prisma.TeacherGroupDeleteArgs,
  isApplyToLessons: boolean
) => {
  await prisma.$transaction(async (tx) => {
    const teacherGroup = await tx.teacherGroup.delete({
      ...payload,
      include: {
        group: true,
      },
    })
    if (isApplyToLessons) {
      await tx.teacherLesson.deleteMany({
        where: {
          teacherId: teacherGroup.teacherId,
          lesson: {
            date: { gt: new Date() },
            groupId: teacherGroup.groupId,
          },
        },
      })
    }
  })
  revalidatePath(`/dashboard/groups/${payload.where.groupId}`)
}
