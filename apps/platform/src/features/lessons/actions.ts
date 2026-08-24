'use server'

import { Prisma } from '@repo/db'
import { AttendanceStatus, CoinTxReason, StudentLessonsBalanceChangeReason } from '@repo/db/enums'
import { prisma } from '@repo/db'
import {
  chargeAttendanceTx,
  isLessonCharged,
  unchargeAttendanceTx,
} from '@/src/features/finances/ledger.server'
import { ATTENDANCE_COINS, recordCoins } from '@/src/lib/coins'
import { ConflictError, NotFoundError } from '@/src/lib/error'
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

/**
 * Начисление/снятие награды за посещение. Каждое изменение баланса обязано
 * оставить строку леджера, иначе инвариант «сумма леджера = coins» разъедется.
 * `updateMany` — потому что `StudentAccount` у ученика может и не быть; строку
 * леджера пишем только когда баланс реально изменился.
 */
const updateCoins = async (
  tx: Prisma.TransactionClient,
  newStatus: AttendanceStatus,
  oldStatus: AttendanceStatus,
  studentId: number,
  organizationId: number,
  attendanceId: number,
) => {
  const granted = newStatus === AttendanceStatus.PRESENT && oldStatus !== AttendanceStatus.PRESENT
  const reverted = newStatus !== AttendanceStatus.PRESENT && oldStatus === AttendanceStatus.PRESENT
  if (!granted && !reverted) return

  const amount = granted ? ATTENDANCE_COINS : -ATTENDANCE_COINS
  const { count } = await tx.studentAccount.updateMany({
    where: {
      studentId,
      organizationId,
      // Снятие награды не имеет права увести баланс в минус: ученик мог уже
      // потратить эти коины. Если их не осталось — просто не снимаем.
      ...(granted ? {} : { coins: { gte: ATTENDANCE_COINS } }),
    },
    data: { coins: { increment: amount } },
  })
  if (count === 0) return

  await recordCoins(tx, {
    organizationId,
    studentId,
    amount,
    reason: granted ? CoinTxReason.ATTENDANCE_PRESENT : CoinTxReason.ATTENDANCE_REVERTED,
    attendanceId,
  })
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
      where: { studentId, lessonId, organizationId: ctx.session.organizationId! },
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
        makeupAttendance: { select: { id: true } },
      },
    })

    if (!oldAttendance) throw new NotFoundError('Запись посещаемости не найдена')

    // Отработка уже назначена: сменить статус оригинала — значит оставить её
    // висеть за занятием, на котором ученик был. Сначала отменяют отработку.
    if (oldAttendance.makeupAttendance) {
      throw new ConflictError('Ученик записан на отработку — статус пропуска не меняется')
    }

    await prisma.$transaction(async (tx) => {
      // Статус переставляем первым: денежные функции ниже читают строку уже в
      // новом виде и сами решают, чем она расплатилась.
      await tx.attendance.update({
        where: {
          studentId_lessonId: { studentId, lessonId },
        },
        // parentMarkedAt сбрасываем: статус переставил сотрудник, значит отметка
        // больше не «со слов родителя» и родитель её из кабинета уже не тронет.
        data: { status, isWarned, parentMarkedAt: null },
      })

      if (oldAttendance.isTrial) return

      await updateCoins(
        tx,
        status as AttendanceStatus,
        oldAttendance.status,
        oldAttendance.studentId,
        ctx.session.organizationId!,
        oldAttendance.id,
      )

      const delta = getLessonsBalanceDelta(
        oldAttendance.status,
        status as AttendanceStatus,
        oldAttendance.isWarned,
        isWarned,
      )
      if (delta === 0) return

      const money = {
        attendanceId: oldAttendance.id,
        organizationId: ctx.session.organizationId!,
        actorUserId: Number(ctx.session.user.id),
        meta: {
          lessonName:
            getGroupName(oldAttendance.lesson.group) +
            ` ${formatDateOnly(oldAttendance.lesson.date)}`,
          oldStatus: oldAttendance.status,
          newStatus: status,
          oldIsWarned: oldAttendance.isWarned,
          newIsWarned: isWarned,
        },
      }

      if (delta < 0) await chargeAttendanceTx(tx, money)
      else await unchargeAttendanceTx(tx, money)
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

    await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.findFirst({
        where: {
          studentId: parsedInput.studentId,
          lessonId: parsedInput.lessonId,
          organizationId: ctx.session.organizationId!,
        },
        select: { id: true },
      })
      if (!attendance) throw new NotFoundError('Запись посещаемости не найдена')

      // Строки не будет — значит и списания: снимаем деньги до удаления.
      await unchargeAttendanceTx(tx, {
        attendanceId: attendance.id,
        organizationId: ctx.session.organizationId!,
        actorUserId: Number(ctx.session.user.id),
        meta: { removed: 'attendance' },
      })
      await tx.attendance.delete({ where: { id: attendance.id } })
    })
  })

export const deleteAttendanceById = authAction
  .metadata({ actionName: 'deleteAttendanceById' })
  .inputSchema(DeleteAttendanceByIdSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.findFirst({
        where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
        select: { id: true },
      })
      if (!attendance) throw new NotFoundError('Запись посещаемости не найдена')

      await unchargeAttendanceTx(tx, {
        attendanceId: attendance.id,
        organizationId: ctx.session.organizationId!,
        actorUserId: Number(ctx.session.user.id),
        meta: { removed: 'attendance' },
      })
      await tx.attendance.delete({ where: { id: attendance.id } })
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
      // Урок за пропуск возвращается: и в пакет, из которого его списали, и на
      // баланс. Спишется он заново уже на отработке — по цене того пакета,
      // который будет головным тогда.
      await prisma.$transaction(async (tx) => {
        await unchargeAttendanceTx(tx, {
          attendanceId: attendance.id,
          organizationId: ctx.session.organizationId!,
          actorUserId: Number(ctx.session.user.id),
          reason: StudentLessonsBalanceChangeReason.MAKEUP_GRANTED,
          meta: { makeupAttendanceId: newAttendance.id },
        })
      })
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

    return await prisma.$transaction(async (tx) => {
      // Отработку перенесли: если по старой дате урок уже списали, возвращаем его
      // в пакет и на баланс — на новой дате он спишется заново.
      await unchargeAttendanceTx(tx, {
        attendanceId: oldMakeupAttendanceId,
        organizationId: ctx.session.organizationId!,
        actorUserId: Number(ctx.session.user.id),
        meta: { rescheduledTo: targetLessonId },
      })
      await tx.attendance.delete({ where: { id: oldMakeupAttendanceId, organizationId } })

      return await tx.attendance.create({
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
