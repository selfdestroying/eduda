'use server'

import { Prisma } from '@/prisma/generated/client'
import { AttendanceStatus, StudentLessonsBalanceChangeReason } from '@/prisma/generated/enums'
import prisma from '@/src/lib/db/prisma'
import { ConflictError, NotFoundError } from '@/src/lib/error'
import { isLessonCharged, writeLessonsBalanceHistoryTx } from '@/src/lib/lessons-balance'
import { authAction } from '@/src/lib/safe-action'
import { DateOnlySchema, formatDateOnly } from '@/src/lib/timezone'
import { getGroupName } from '@/src/lib/utils'
import * as z from 'zod'
import {
  AddTeacherToLessonSchema,
  CancelLessonSchema,
  CreateAttendanceSchema,
  CreateMakeupSchema,
  DeleteAttendanceByIdSchema,
  DeleteAttendanceSchema,
  DeleteTeacherLessonSchema,
  EditLessonSchema,
  EditTeacherLessonSchema,
  RescheduleMakeupSchema,
  RestoreLessonSchema,
  UpdateAttendanceCommentSchema,
  UpdateAttendanceStatusSchema,
  UpdateAttendanceTrialStatusSchema,
} from './schemas'

// ─── Lesson Detail ───────────────────────────────────────────────────────────

export const getLessonDetail = authAction
  .metadata({ actionName: 'getLessonDetail' })
  .inputSchema(z.object({ id: z.number().int().positive() }))
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.lesson.findFirst({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      include: {
        teachers: {
          include: { teacher: true },
        },
        group: {
          include: {
            course: true,
            location: true,
            schedules: true,
            groupType: { include: { rate: true } },
          },
        },
        attendance: {
          include: {
            student: true,
            makeupForAttendance: { include: { lesson: true } },
            makeupAttendance: { include: { lesson: true } },
          },
          orderBy: [{ isTrial: 'desc' }, { student: { firstName: 'asc' } }],
        },
      },
    })
  })

// ─── Lesson List (by date, for makeup dialog) ───────────────────────────────

export const getLessonsByDate = authAction
  .metadata({ actionName: 'getLessonsByDate' })
  .inputSchema(z.object({ date: DateOnlySchema }))
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.lesson.findMany({
      where: {
        date: parsedInput.date,
        organizationId: ctx.session.organizationId!,
      },
      include: {
        attendance: true,
        group: { include: { course: true, location: true, schedules: true } },
        teachers: { include: { teacher: true } },
      },
      orderBy: { time: 'asc' },
    })
  })

// ─── Edit Lesson ─────────────────────────────────────────────────────────────

export const updateLesson = authAction
  .metadata({ actionName: 'updateLesson' })
  .inputSchema(EditLessonSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.lesson.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

// ─── Cancel Lesson ───────────────────────────────────────────────────────────

export const cancelLesson = authAction
  .metadata({ actionName: 'cancelLesson' })
  .inputSchema(CancelLessonSchema)
  .action(async ({ ctx, parsedInput }) => {
    const lesson = await prisma.lesson.findFirst({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      select: { status: true },
    })
    if (!lesson) throw new NotFoundError('Урок не найден')
    if (lesson.status === 'CANCELLED') throw new ConflictError('Урок уже отменён')

    await prisma.lesson.update({
      where: { id: parsedInput.id },
      data: { status: 'CANCELLED' },
    })
  })

// ─── Restore Lesson ─────────────────────────────────────────────────────────

export const restoreLesson = authAction
  .metadata({ actionName: 'restoreLesson' })
  .inputSchema(RestoreLessonSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.lesson.update({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      data: { status: 'ACTIVE' },
    })
  })

// ─── Create Attendance ───────────────────────────────────────────────────────

export const createAttendance = authAction
  .metadata({ actionName: 'createAttendance' })
  .inputSchema(CreateAttendanceSchema)
  .action(async ({ ctx, parsedInput }) => {
    const lesson = await prisma.lesson.findUnique({
      where: { id: parsedInput.lessonId },
      select: { status: true },
    })
    if (lesson?.status === 'CANCELLED') {
      throw new ConflictError('Нельзя добавить ученика в отменённый урок')
    }

    return await prisma.attendance.create({
      data: {
        organizationId: ctx.session.organizationId!,
        studentId: parsedInput.studentId,
        lessonId: parsedInput.lessonId,
        isTrial: parsedInput.isTrial,
        walletId: parsedInput.walletId ?? null,
        status: 'UNSPECIFIED',
        comment: '',
      },
    })
  })

// ─── Update Attendance Status ────────────────────────────────────────────────

const updateCoins = async (
  tx: Prisma.TransactionClient,
  newStatus: AttendanceStatus,
  oldStatus: AttendanceStatus,
  studentId: number,
) => {
  if (newStatus === AttendanceStatus.PRESENT && oldStatus !== AttendanceStatus.PRESENT) {
    await tx.studentAccount.updateMany({
      where: { studentId },
      data: { coins: { increment: 10 } },
    })
  } else if (newStatus !== AttendanceStatus.PRESENT && oldStatus === AttendanceStatus.PRESENT) {
    await tx.studentAccount.updateMany({
      where: { studentId },
      data: { coins: { decrement: 10 } },
    })
  }
}

const getLessonsBalanceDelta = (
  oldStatus: AttendanceStatus,
  newStatus: AttendanceStatus,
  oldIsWarned: boolean | null,
  newIsWarned: boolean | null,
): number => {
  const wasCharged = isLessonCharged(oldStatus, oldIsWarned === true)
  const isCharged = isLessonCharged(newStatus, newIsWarned === true)
  if (wasCharged === isCharged) return 0
  return isCharged ? -1 : +1
}

export const updateAttendanceStatus = authAction
  .metadata({ actionName: 'updateAttendanceStatus' })
  .inputSchema(UpdateAttendanceStatusSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { studentId, lessonId, status, isWarned } = parsedInput

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { status: true },
    })
    if (lesson?.status === 'CANCELLED') {
      throw new ConflictError('Нельзя изменить посещаемость отменённого урока')
    }

    const oldAttendance = await prisma.attendance.findFirst({
      where: { studentId, lessonId },
      include: {
        lesson: {
          include: {
            group: {
              include: {
                course: true,
                location: true,
                schedules: true,
              },
            },
          },
        },
        makeupForAttendance: {
          include: { lesson: true },
        },
      },
    })

    if (!oldAttendance) throw new NotFoundError('Запись посещаемости не найдена')

    await prisma.$transaction(async (tx) => {
      if (!oldAttendance.isTrial) {
        await updateCoins(
          tx,
          status as AttendanceStatus,
          oldAttendance.status,
          oldAttendance.studentId,
        )

        const delta = getLessonsBalanceDelta(
          oldAttendance.status,
          status as AttendanceStatus,
          oldAttendance.isWarned,
          isWarned,
        )

        if (delta !== 0) {
          const groupId = oldAttendance.makeupForAttendance
            ? oldAttendance.makeupForAttendance.lesson.groupId
            : oldAttendance.lesson.groupId
          const studentGroup = await tx.studentGroup.findUnique({
            where: { studentId_groupId: { studentId: oldAttendance.studentId, groupId } },
            select: { walletId: true },
          })
          // Разовое посещение: ученик не в группе урока — списываем с кошелька,
          // выбранного при добавлении (attendance.walletId). Иначе — кошелёк группы.
          const walletId = oldAttendance.walletId ?? studentGroup?.walletId

          if (walletId) {
            const wallet = await tx.wallet.findUnique({
              where: { id: walletId },
              select: { lessonsBalance: true },
            })
            if (!wallet) throw new NotFoundError('Кошелёк не найден')

            const balanceBefore = wallet.lessonsBalance
            const updated = await tx.wallet.update({
              where: { id: walletId },
              data: {
                lessonsBalance: delta > 0 ? { increment: delta } : { decrement: Math.abs(delta) },
              },
              select: { lessonsBalance: true },
            })

            const balanceAfter = updated.lessonsBalance
            const isMakeupAttendance = Boolean(oldAttendance.makeupForAttendanceId)

            const reason = (() => {
              if (delta >= 0) return StudentLessonsBalanceChangeReason.ATTENDANCE_REVERTED
              if (isMakeupAttendance)
                return StudentLessonsBalanceChangeReason.MAKEUP_ATTENDED_CHARGED
              if (status === AttendanceStatus.PRESENT)
                return StudentLessonsBalanceChangeReason.ATTENDANCE_PRESENT_CHARGED
              return StudentLessonsBalanceChangeReason.ATTENDANCE_ABSENT_CHARGED
            })()

            const lessonName =
              getGroupName(oldAttendance.lesson.group) +
              ` ${formatDateOnly(oldAttendance.lesson.date)}`

            await writeLessonsBalanceHistoryTx(tx, {
              organizationId: ctx.session.organizationId!,
              studentId: oldAttendance.studentId,
              actorUserId: Number(ctx.session.user.id),
              groupId,
              walletId,
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

      await tx.attendance.update({
        where: {
          studentId_lessonId: { studentId, lessonId },
        },
        data: { status, isWarned },
      })
    })
  })

// ─── Update Attendance Student Status ────────────────────────────────────────

export const updateAttendanceTrialStatus = authAction
  .metadata({ actionName: 'updateAttendanceTrialStatus' })
  .inputSchema(UpdateAttendanceTrialStatusSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.attendance.update({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      data: { isTrial: parsedInput.isTrial },
    })
  })

// ─── Update Attendance Comment ───────────────────────────────────────────────

export const updateAttendanceComment = authAction
  .metadata({ actionName: 'updateAttendanceComment' })
  .inputSchema(UpdateAttendanceCommentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.attendance.update({
      where: {
        studentId_lessonId: {
          studentId: parsedInput.studentId,
          lessonId: parsedInput.lessonId,
        },
        organizationId: ctx.session.organizationId!,
      },
      data: { comment: parsedInput.comment },
    })
  })

// ─── Delete Attendance ───────────────────────────────────────────────────────

export const deleteAttendance = authAction
  .metadata({ actionName: 'deleteAttendance' })
  .inputSchema(DeleteAttendanceSchema)
  .action(async ({ ctx, parsedInput }) => {
    const lesson = await prisma.lesson.findUnique({
      where: { id: parsedInput.lessonId },
      select: { status: true },
    })
    if (lesson?.status === 'CANCELLED') {
      throw new ConflictError('Нельзя удалить ученика из отменённого урока')
    }

    await prisma.attendance.delete({
      where: {
        studentId_lessonId: {
          studentId: parsedInput.studentId,
          lessonId: parsedInput.lessonId,
        },
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const deleteAttendanceById = authAction
  .metadata({ actionName: 'deleteAttendanceById' })
  .inputSchema(DeleteAttendanceByIdSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.attendance.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })

// ─── Create Makeup ───────────────────────────────────────────────────────────

export const createMakeup = authAction
  .metadata({ actionName: 'createMakeup' })
  .inputSchema(CreateMakeupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { attendanceId, studentId, targetLessonId, creditBalance } = parsedInput
    const organizationId = ctx.session.organizationId!

    const attendance = await prisma.attendance.findFirst({
      where: { id: attendanceId, organizationId },
      include: { lesson: true },
    })
    if (!attendance) throw new NotFoundError('Запись посещаемости не найдена')

    const newAttendance = await prisma.attendance.create({
      data: {
        organizationId,
        studentId,
        lessonId: targetLessonId,
        comment: '',
        status: 'UNSPECIFIED',
        makeupForAttendanceId: attendanceId,
      },
    })

    if (creditBalance) {
      const originalGroupId = attendance.lesson.groupId
      const studentGroup = await prisma.studentGroup.findUnique({
        where: { studentId_groupId: { studentId, groupId: originalGroupId } },
        select: { walletId: true },
      })
      if (studentGroup?.walletId) {
        await prisma.wallet.update({
          where: { id: studentGroup.walletId },
          data: { lessonsBalance: { increment: 1 } },
        })
      }
    }

    return newAttendance
  })

// ─── Reschedule Makeup ───────────────────────────────────────────────────────

export const rescheduleMakeup = authAction
  .metadata({ actionName: 'rescheduleMakeup' })
  .inputSchema(RescheduleMakeupSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { attendanceId, oldMakeupAttendanceId, studentId, targetLessonId } = parsedInput
    const organizationId = ctx.session.organizationId!

    await prisma.attendance.delete({
      where: { id: oldMakeupAttendanceId, organizationId },
    })

    return await prisma.attendance.create({
      data: {
        organizationId,
        studentId,
        lessonId: targetLessonId,
        comment: '',
        status: 'UNSPECIFIED',
        makeupForAttendanceId: attendanceId,
      },
    })
  })

// ─── Teacher Lesson ──────────────────────────────────────────────────────────

export const createTeacherLesson = authAction
  .metadata({ actionName: 'createTeacherLesson' })
  .inputSchema(AddTeacherToLessonSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.teacherLesson.create({
      data: {
        organizationId: ctx.session.organizationId!,
        lessonId: parsedInput.lessonId,
        teacherId: parsedInput.teacherId,
        bid: parsedInput.bid,
        bonusPerStudent: parsedInput.bonusPerStudent,
      },
    })
  })

export const updateTeacherLesson = authAction
  .metadata({ actionName: 'updateTeacherLesson' })
  .inputSchema(EditTeacherLessonSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { teacherId, lessonId, ...data } = parsedInput
    await prisma.teacherLesson.update({
      where: {
        teacherId_lessonId: { teacherId, lessonId },
        organizationId: ctx.session.organizationId!,
      },
      data,
    })
  })

export const deleteTeacherLesson = authAction
  .metadata({ actionName: 'deleteTeacherLesson' })
  .inputSchema(DeleteTeacherLessonSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.teacherLesson.delete({
      where: {
        teacherId_lessonId: {
          teacherId: parsedInput.teacherId,
          lessonId: parsedInput.lessonId,
        },
        organizationId: ctx.session.organizationId!,
      },
    })
  })
