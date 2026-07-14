'use server'

import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { todayYmdInTz } from '@/src/lib/timezone'
import * as z from 'zod'
import {
  AddStudentToGroupSchema,
  AddTeacherToGroupSchema,
  ArchiveGroupSchema,
  CompleteGroupSchema,
  CreateGroupSchema,
  CreateLessonForGroupSchema,
  DeleteGroupSchema,
  DeleteStudentGroupSchema,
  DeleteTeacherGroupSchema,
  DismissStudentSchema,
  EditTeacherGroupSchema,
  TransferStudentSchema,
  UpdateGroupSchema,
  UpdateScheduleAndLessonsSchema,
  UpdateScheduleOnlySchema,
} from './schemas'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

// ─── READ ───────────────────────────────────────────────────────────

export const getGroups = authAction
  .metadata({ actionName: 'getGroups' })
  .action(async ({ ctx }) => {
    return await prisma.group.findMany({
      where: { organizationId: ctx.session.organizationId! },
      include: {
        groupType: { include: { rate: true } },
        location: true,
        course: true,
        schedules: true,
        teachers: { include: { teacher: true } },
        students: { include: { student: true } },
      },
      orderBy: { id: 'asc' },
    })
  })

export const getGroup = authAction
  .metadata({ actionName: 'getGroup' })
  .inputSchema(z.object({ id: z.int().positive() }))
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.group.findFirst({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      include: {
        location: true,
        course: true,
        students: true,
        schedules: true,
        groupType: { include: { rate: true } },
        teachers: { include: { teacher: true } },
      },
    })
  })

// ─── CREATE ─────────────────────────────────────────────────────────

export const createGroup = authAction
  .metadata({ actionName: 'createGroup' })
  .inputSchema(CreateGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const orgId = ctx.session.organizationId!
    const {
      courseId,
      locationId,
      teacherId,
      rateId,
      startDate,
      lessonCount,
      schedule,
      maxStudents,
      groupTypeId,
      url,
    } = parsedInput

    const sortedSchedule = [...schedule].sort(
      (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
    )
    const scheduleDaysMap = new Map(sortedSchedule.map((s) => [s.dayOfWeek, s.time]))

    // Generate lesson dates (`YYYY-MM-DD`)
    const lessons: Array<{ date: string; time: string; organizationId: number }> = []
    const currentDate = new Date(`${startDate}T00:00:00Z`)
    const maxIterations = lessonCount * 7 + 7

    for (let i = 0; i < maxIterations && lessons.length < lessonCount; i++) {
      const time = scheduleDaysMap.get(currentDate.getUTCDay())
      if (time) {
        lessons.push({ date: currentDate.toISOString().slice(0, 10), time, organizationId: orgId })
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }

    await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          organizationId: orgId,
          courseId,
          locationId,
          maxStudents,
          groupTypeId,
          url,
          startDate,
          teachers: {
            create: [{ organizationId: orgId, teacherId, rateId }],
          },
          lessons: { createMany: { data: lessons } },
        },
        include: {
          teachers: { include: { rate: true } },
          lessons: { select: { id: true } },
        },
      })

      const firstTeacher = group.teachers[0]
      if (!firstTeacher) throw new Error('Group must have at least one teacher')

      await tx.teacherLesson.createMany({
        data: group.lessons.map((l) => ({
          organizationId: orgId,
          lessonId: l.id,
          teacherId: firstTeacher.teacherId,
          bid: firstTeacher.rate.bid,
          bonusPerStudent: firstTeacher.rate.bonusPerStudent,
        })),
      })

      if (sortedSchedule.length > 0) {
        await tx.groupSchedule.createMany({
          data: sortedSchedule.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            time: s.time,
            groupId: group.id,
            organizationId: orgId,
          })),
        })
      }
    })
  })

// ─── UPDATE ─────────────────────────────────────────────────────────

export const updateGroup = authAction
  .metadata({ actionName: 'updateGroup' })
  .inputSchema(UpdateGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.group.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

// ─── DELETE ─────────────────────────────────────────────────────────

export const deleteGroup = authAction
  .metadata({ actionName: 'deleteGroup' })
  .inputSchema(DeleteGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.group.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })

// ─── ARCHIVE ────────────────────────────────────────────────────────

export const archiveGroup = authAction
  .metadata({ actionName: 'archiveGroup' })
  .inputSchema(ArchiveGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { groupId, statusChangedAt, comment, deleteFutureLessons } = parsedInput
    const statusChangedAtYmd = statusChangedAt ?? todayYmdInTz(ctx.tz)
    await prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id: groupId, organizationId: ctx.session.organizationId! },
        data: {
          status: 'ARCHIVED',
          statusChangedAt: statusChangedAtYmd,
          statusComment: comment ?? null,
        },
      })

      if (deleteFutureLessons) {
        await tx.lesson.deleteMany({
          where: { groupId, date: { gte: statusChangedAtYmd } },
        })
      }
    })
  })

// ─── COMPLETE ───────────────────────────────────────────────────────

export const completeGroup = authAction
  .metadata({ actionName: 'completeGroup' })
  .inputSchema(CompleteGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { groupId, statusChangedAt, comment, deleteFutureLessons } = parsedInput
    const statusChangedAtYmd = statusChangedAt ?? todayYmdInTz(ctx.tz)
    await prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id: groupId, organizationId: ctx.session.organizationId! },
        data: {
          status: 'COMPLETED',
          statusChangedAt: statusChangedAtYmd,
          statusComment: comment ?? null,
        },
      })

      await tx.studentGroup.updateMany({
        where: { groupId, status: { in: ['ACTIVE', 'TRIAL'] } },
        data: {
          status: 'COMPLETED',
          statusChangedAt: statusChangedAtYmd,
          statusComment: null,
        },
      })

      if (deleteFutureLessons) {
        await tx.lesson.deleteMany({
          where: { groupId, date: { gte: statusChangedAtYmd } },
        })
      }
    })
  })

export const countFutureLessons = authAction
  .metadata({ actionName: 'countFutureLessons' })
  .inputSchema(
    z.object({
      groupId: z.number().int().positive(),
      afterDate: z.string().optional(),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const afterDate = parsedInput.afterDate ?? todayYmdInTz(ctx.tz)
    return await prisma.lesson.count({
      where: {
        groupId: parsedInput.groupId,
        date: { gte: afterDate },
        group: { organizationId: ctx.session.organizationId! },
      },
    })
  })

// ─── SCHEDULE MANAGEMENT ────────────────────────────────────────────

export const updateScheduleAndRegenerateLessons = authAction
  .metadata({ actionName: 'updateScheduleAndRegenerateLessons' })
  .inputSchema(UpdateScheduleAndLessonsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const orgId = ctx.session.organizationId!
    const { groupId, schedule, startDate, lessonCount } = parsedInput

    return await prisma.$transaction(async (tx) => {
      // 1. Verify ownership
      await tx.group.findFirstOrThrow({ where: { id: groupId, organizationId: orgId } })

      // 2. Update schedule
      await tx.groupSchedule.deleteMany({ where: { groupId } })
      await tx.groupSchedule.createMany({
        data: schedule.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          time: s.time,
          groupId,
          organizationId: orgId,
        })),
      })

      if (!startDate || !lessonCount) {
        return { scheduleUpdated: true, deletedLessonsCount: 0, createdLessonsCount: 0 }
      }

      // 3. Build schedule map
      const sortedSchedules = [...schedule].sort(
        (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
      )
      const scheduleDaysMap = new Map(sortedSchedules.map((s) => [s.dayOfWeek, s.time]))

      // 4. Delete future lessons
      const { count: deletedLessonsCount } = await tx.lesson.deleteMany({
        where: { groupId, date: { gte: startDate } },
      })

      // 5. Generate new lesson dates (`YYYY-MM-DD`)
      const lessons: Array<{ date: string; time: string; organizationId: number }> = []
      const currentDate = new Date(`${startDate}T00:00:00Z`)
      const maxIterations = lessonCount * 7 + 7

      for (let i = 0; i < maxIterations && lessons.length < lessonCount; i++) {
        const time = scheduleDaysMap.get(currentDate.getUTCDay())
        if (time) {
          lessons.push({
            date: currentDate.toISOString().slice(0, 10),
            time,
            organizationId: orgId,
          })
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1)
      }

      // 6. Create lessons
      const createdLessons = await Promise.all(
        lessons.map((l) =>
          tx.lesson.create({
            data: { date: l.date, time: l.time, organizationId: l.organizationId, groupId },
          }),
        ),
      )

      // 7. Assign teachers
      const teachers = await tx.teacherGroup.findMany({
        where: { groupId },
        include: { rate: true },
      })

      if (teachers.length > 0) {
        await tx.teacherLesson.createMany({
          data: createdLessons.flatMap((lesson) =>
            teachers.map((t) => ({
              organizationId: orgId,
              lessonId: lesson.id,
              teacherId: t.teacherId,
              bid: t.rate.bid,
              bonusPerStudent: t.rate.bonusPerStudent,
            })),
          ),
        })
      }

      // 8. Create UNSPECIFIED attendance for active students
      const students = await tx.studentGroup.findMany({
        where: { groupId, status: { in: ['ACTIVE'] } },
      })

      if (students.length > 0) {
        await tx.attendance.createMany({
          data: createdLessons.flatMap((lesson) =>
            students.map((s) => ({
              organizationId: orgId,
              lessonId: lesson.id,
              studentId: s.studentId,
              status: 'UNSPECIFIED' as const,
              isTrial: s.status === 'TRIAL',
              comment: '',
            })),
          ),
        })
      }

      return {
        scheduleUpdated: true,
        deletedLessonsCount,
        createdLessonsCount: createdLessons.length,
      }
    })
  })

export const updateScheduleOnly = authAction
  .metadata({ actionName: 'updateScheduleOnly' })
  .inputSchema(UpdateScheduleOnlySchema)
  .action(async ({ ctx, parsedInput }) => {
    const orgId = ctx.session.organizationId!
    const { groupId, schedule } = parsedInput

    return await prisma.$transaction(async (tx) => {
      // Verify ownership
      await tx.group.findFirstOrThrow({ where: { id: groupId, organizationId: orgId } })

      // Update schedule records
      await tx.groupSchedule.deleteMany({ where: { groupId } })
      await tx.groupSchedule.createMany({
        data: schedule.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          time: s.time,
          groupId,
          organizationId: orgId,
        })),
      })

      // Build day → time map
      const scheduleDaysMap = new Map(schedule.map((s) => [s.dayOfWeek, s.time]))

      // Update time on future lessons that match schedule days
      const today = todayYmdInTz(ctx.tz)
      const futureLessons = await tx.lesson.findMany({
        where: { groupId, date: { gte: today } },
        select: { id: true, date: true },
      })

      let updatedCount = 0
      for (const lesson of futureLessons) {
        const newTime = scheduleDaysMap.get(new Date(`${lesson.date}T00:00:00Z`).getUTCDay())
        if (newTime) {
          await tx.lesson.update({ where: { id: lesson.id }, data: { time: newTime } })
          updatedCount++
        }
      }

      return { scheduleUpdated: true, updatedLessonsCount: updatedCount }
    })
  })

// ─── GROUP DETAIL ────────────────────────────────────────────────────

export const getGroupDetail = authAction
  .metadata({ actionName: 'getGroupDetail' })
  .inputSchema(z.object({ id: z.int().positive() }))
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.group.findFirst({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      include: {
        lessons: {
          include: {
            attendance: {
              include: {
                student: true,
                makeupForAttendance: { include: { lesson: true } },
                makeupAttendance: { include: { lesson: true } },
              },
            },
          },
          orderBy: { date: 'asc' },
        },
        location: true,
        course: true,
        schedules: true,
        groupType: { include: { rate: true } },
        teachers: { include: { teacher: true, rate: true } },
        students: {
          where: { status: { in: ['ACTIVE', 'TRIAL', 'COMPLETED'] } },
          include: { student: true },
        },
      },
    })
  })

// ─── STUDENT-GROUP OPERATIONS ───────────────────────────────────────

export const addStudentToGroup = authAction
  .metadata({ actionName: 'addStudentToGroup' })
  .inputSchema(AddStudentToGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const orgId = ctx.session.organizationId!
    const { groupId, studentId, walletId, isApplyToLesson, newWalletName } = parsedInput

    return await prisma.$transaction(async (tx) => {
      let effectiveWalletId = walletId

      if (newWalletName !== undefined) {
        const newWallet = await tx.wallet.create({
          data: {
            studentId,
            organizationId: orgId,
            name: newWalletName || undefined,
          },
        })
        effectiveWalletId = newWallet.id
      }

      await tx.studentGroup.create({
        data: {
          organizationId: orgId,
          groupId,
          studentId,
          status: 'ACTIVE',
          statusChangedAt: todayYmdInTz(ctx.tz),
          ...(effectiveWalletId ? { walletId: effectiveWalletId } : {}),
        },
      })

      if (!isApplyToLesson) return

      const todayDate = todayYmdInTz(ctx.tz)
      const futureLessons = await tx.lesson.findMany({
        where: { groupId, date: { gte: todayDate } },
        select: { id: true, organizationId: true },
      })

      if (futureLessons.length > 0) {
        await tx.attendance.createMany({
          data: futureLessons.map((lesson) => ({
            organizationId: lesson.organizationId,
            lessonId: lesson.id,
            studentId,
            comment: '',
            status: 'UNSPECIFIED' as const,
          })),
          skipDuplicates: true,
        })
      }
    })
  })

export const removeStudentFromGroup = authAction
  .metadata({ actionName: 'removeStudentFromGroup' })
  .inputSchema(DeleteStudentGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { studentId, groupId } = parsedInput
    await prisma.$transaction(async (tx) => {
      // Verify org ownership
      await tx.group.findFirstOrThrow({
        where: { id: groupId, organizationId: ctx.session.organizationId! },
      })
      await tx.studentGroup.delete({
        where: { studentId_groupId: { studentId, groupId } },
      })
      await tx.attendance.deleteMany({
        where: { studentId, lesson: { groupId } },
      })
    })
  })

export const dismissStudentFromGroup = authAction
  .metadata({ actionName: 'dismissStudentFromGroup' })
  .inputSchema(DismissStudentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { studentId, groupId, statusChangedAt, comment } = parsedInput
    await prisma.$transaction(async (tx) => {
      // Verify org ownership
      await tx.group.findFirstOrThrow({
        where: { id: groupId, organizationId: ctx.session.organizationId! },
      })
      await tx.studentGroup.update({
        where: {
          studentId_groupId: { studentId, groupId },
        },
        data: {
          status: 'DISMISSED',
          statusComment: comment,
          statusChangedAt,
        },
      })

      const todayDate = todayYmdInTz(ctx.tz)
      const futureLessons = await tx.lesson.findMany({
        where: { groupId, date: { gte: todayDate } },
        select: { id: true },
      })

      if (futureLessons.length > 0) {
        await tx.attendance.deleteMany({
          where: {
            studentId,
            lessonId: { in: futureLessons.map((l) => l.id) },
            status: 'UNSPECIFIED',
          },
        })
      }
    })
  })

export const transferStudent = authAction
  .metadata({ actionName: 'transferStudent' })
  .inputSchema(TransferStudentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const orgId = ctx.session.organizationId!
    const { studentId, oldGroupId, newGroupId } = parsedInput

    await prisma.$transaction(async (tx) => {
      const oldSg = await tx.studentGroup.findUniqueOrThrow({
        where: { studentId_groupId: { studentId, groupId: oldGroupId } },
      })

      const newGroup = await tx.group.findUniqueOrThrow({
        where: { id: newGroupId },
        include: { course: true, location: true, schedules: true },
      })

      const { getGroupName } = await import('@/src/lib/utils')
      const newGroupName = getGroupName(newGroup)

      await tx.studentGroup.update({
        where: { studentId_groupId: { studentId, groupId: oldGroupId } },
        data: {
          status: 'TRANSFERRED',
          statusChangedAt: todayYmdInTz(ctx.tz),
          statusComment: `Переведён в группу ${newGroupName}`,
        },
      })

      const existingSg = await tx.studentGroup.findUnique({
        where: { studentId_groupId: { studentId, groupId: newGroupId } },
      })

      if (existingSg) {
        if (existingSg.status === 'ACTIVE' || existingSg.status === 'TRIAL') {
          throw new Error('Ученик уже в этой группе')
        }
        await tx.studentGroup.update({
          where: { studentId_groupId: { studentId, groupId: newGroupId } },
          data: {
            status: 'ACTIVE',
            statusComment: null,
            statusChangedAt: todayYmdInTz(ctx.tz),
            walletId: oldSg.walletId,
          },
        })
      } else {
        await tx.studentGroup.create({
          data: {
            studentId,
            groupId: newGroupId,
            organizationId: orgId,
            status: 'ACTIVE',
            statusChangedAt: todayYmdInTz(ctx.tz),
            walletId: oldSg.walletId,
          },
        })
      }

      await tx.attendance.deleteMany({
        where: { studentId, status: 'UNSPECIFIED', lesson: { groupId: oldGroupId } },
      })

      const today = todayYmdInTz(ctx.tz)
      const newFutureLessons = await tx.lesson.findMany({
        where: { groupId: newGroupId, date: { gte: today } },
        select: { id: true, organizationId: true },
      })

      if (newFutureLessons.length > 0) {
        await tx.attendance.createMany({
          data: newFutureLessons.map((lesson) => ({
            organizationId: lesson.organizationId,
            lessonId: lesson.id,
            studentId,
            comment: '',
            status: 'UNSPECIFIED' as const,
          })),
          skipDuplicates: true,
        })
      }
    })
  })

// ─── TEACHER-GROUP OPERATIONS ───────────────────────────────────────

export const addTeacherToGroup = authAction
  .metadata({ actionName: 'addTeacherToGroup' })
  .inputSchema(AddTeacherToGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const orgId = ctx.session.organizationId!
    const { groupId, teacherId, rateId, isApplyToLesson } = parsedInput

    await prisma.$transaction(async (tx) => {
      const teacherGroup = await tx.teacherGroup.create({
        data: { organizationId: orgId, groupId, teacherId, rateId },
        include: {
          rate: true,
          group: {
            include: {
              lessons: {
                where: {
                  date: { gt: todayYmdInTz(ctx.tz) },
                  teachers: { none: { teacherId } },
                },
              },
            },
          },
        },
      })

      if (isApplyToLesson) {
        for (const lesson of teacherGroup.group.lessons) {
          await tx.teacherLesson.create({
            data: {
              organizationId: lesson.organizationId,
              lessonId: lesson.id,
              teacherId,
              bid: teacherGroup.rate.bid,
              bonusPerStudent: teacherGroup.rate.bonusPerStudent,
            },
          })
        }
      }
    })
  })

export const editTeacherGroup = authAction
  .metadata({ actionName: 'editTeacherGroup' })
  .inputSchema(EditTeacherGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { teacherId, groupId, rateId, isApplyToLessons } = parsedInput

    await prisma.$transaction(async (tx) => {
      // Verify org ownership
      await tx.group.findFirstOrThrow({
        where: { id: groupId, organizationId: ctx.session.organizationId! },
      })
      const teacherGroup = await tx.teacherGroup.update({
        where: {
          teacherId_groupId: { teacherId, groupId },
        },
        data: { rateId },
        include: { rate: true },
      })

      if (isApplyToLessons) {
        await tx.teacherLesson.updateMany({
          where: {
            teacherId,
            lesson: {
              date: { gt: todayYmdInTz(ctx.tz) },
              groupId,
            },
          },
          data: {
            bid: teacherGroup.rate.bid,
            bonusPerStudent: teacherGroup.rate.bonusPerStudent,
          },
        })
      }
    })
  })

export const removeTeacherFromGroup = authAction
  .metadata({ actionName: 'removeTeacherFromGroup' })
  .inputSchema(DeleteTeacherGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { teacherId, groupId, isApplyToLessons } = parsedInput

    await prisma.$transaction(async (tx) => {
      // Verify org ownership
      await tx.group.findFirstOrThrow({
        where: { id: groupId, organizationId: ctx.session.organizationId! },
      })
      await tx.teacherGroup.delete({
        where: {
          teacherId_groupId: { teacherId, groupId },
        },
      })

      if (isApplyToLessons) {
        await tx.teacherLesson.deleteMany({
          where: {
            teacherId,
            lesson: {
              date: { gt: todayYmdInTz(ctx.tz) },
              groupId,
            },
          },
        })
      }
    })
  })

// ─── LESSON CREATION ────────────────────────────────────────────────

export const createLessonForGroup = authAction
  .metadata({ actionName: 'createLessonForGroup' })
  .inputSchema(CreateLessonForGroupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const orgId = ctx.session.organizationId!
    const { groupId, date, time } = parsedInput

    await prisma.$transaction(async (tx) => {
      const group = await tx.group.findFirstOrThrow({
        where: { id: groupId, organizationId: orgId },
        include: {
          students: { where: { status: { in: ['ACTIVE', 'TRIAL'] } } },
          teachers: { include: { rate: true } },
        },
      })

      const lesson = await tx.lesson.create({
        data: { date, time, organizationId: orgId, groupId },
      })

      if (group.students.length > 0) {
        await tx.attendance.createMany({
          data: group.students.map((sg) => ({
            organizationId: orgId,
            lessonId: lesson.id,
            studentId: sg.studentId,
            status: 'UNSPECIFIED' as const,
            comment: '',
          })),
        })
      }

      if (group.teachers.length > 0) {
        await tx.teacherLesson.createMany({
          data: group.teachers.map((tg) => ({
            organizationId: orgId,
            lessonId: lesson.id,
            teacherId: tg.teacherId,
            bid: tg.rate.bid,
            bonusPerStudent: tg.rate.bonusPerStudent,
          })),
        })
      }
    })
  })
