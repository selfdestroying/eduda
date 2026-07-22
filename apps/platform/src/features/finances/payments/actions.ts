'use server'

import { StudentFinancialField, StudentLessonsBalanceChangeReason } from '@/prisma/generated/enums'
import prisma from '@/src/lib/db/prisma'
import { writeFinancialHistoryTx } from '@/src/lib/lessons-balance'
import { authAction } from '@/src/lib/safe-action'
import {
  CancelPaymentSchema,
  CreatePaymentSchema,
  DeleteUnprocessedPaymentSchema,
  ResolveUnprocessedPaymentSchema,
} from './schemas'

export const getPayments = authAction
  .metadata({ actionName: 'getPayments' })
  .action(async ({ ctx }) => {
    return await prisma.payment.findMany({
      where: { organizationId: ctx.session.organizationId! },
      include: {
        student: true,
        group: { include: { course: true, location: true } },
        paymentMethod: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  })

export const getStudentsForPayments = authAction
  .metadata({ actionName: 'getStudentsForPayments' })
  .action(async ({ ctx }) => {
    return await prisma.student.findMany({
      where: { organizationId: ctx.session.organizationId! },
      orderBy: { id: 'asc' },
      include: {
        wallets: {
          include: {
            studentGroups: {
              include: {
                group: { include: { course: true, location: true, schedules: true } },
              },
            },
          },
        },
      },
    })
  })

export const createPaymentWithBalance = authAction
  .metadata({ actionName: 'createPaymentWithBalance' })
  .inputSchema(CreatePaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const {
      studentId,
      wallet: walletInput,
      lessonCount,
      price,
      date,
      paymentMethodId,
    } = parsedInput
    const walletId = walletInput.value

    const paymentMeta = { lessonCount, price, walletId }

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
        select: {
          lessonsBalance: true,
          totalPayments: true,
          totalLessons: true,
          organizationId: true,
          studentId: true,
        },
      })
      if (!wallet) throw new Error('Кошелёк не найден')
      if (wallet.studentId !== studentId) throw new Error('Кошелёк не принадлежит этому ученику')

      await tx.payment.create({
        data: {
          organizationId: wallet.organizationId,
          studentId,
          walletId,
          lessonCount,
          price,
          bidForLesson: Math.floor(price / lessonCount),
          date,
          paymentMethodId: paymentMethodId ?? null,
        },
      })

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: {
          lessonsBalance: { increment: lessonCount },
          totalLessons: { increment: lessonCount },
          totalPayments: { increment: price },
        },
        select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
      })

      const fields = [
        {
          field: StudentFinancialField.LESSONS_BALANCE,
          key: 'lessonsBalance' as const,
        },
        {
          field: StudentFinancialField.TOTAL_PAYMENTS,
          key: 'totalPayments' as const,
        },
        {
          field: StudentFinancialField.TOTAL_LESSONS,
          key: 'totalLessons' as const,
        },
      ]

      for (const f of fields) {
        await writeFinancialHistoryTx(tx, {
          organizationId: ctx.session.organizationId!,
          studentId,
          actorUserId: Number(ctx.session.user.id),
          walletId,
          field: f.field,
          reason: StudentLessonsBalanceChangeReason.PAYMENT_CREATED,
          delta: updated[f.key] - wallet[f.key],
          balanceBefore: wallet[f.key],
          balanceAfter: updated[f.key],
          meta: paymentMeta,
        })
      }
    })
  })

export const cancelPayment = authAction
  .metadata({ actionName: 'cancelPayment' })
  .inputSchema(CancelPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.delete({
        where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      })

      let balancesBefore: { lessonsBalance: number; totalPayments: number; totalLessons: number }
      let balancesAfter: { lessonsBalance: number; totalPayments: number; totalLessons: number }
      const resolvedWalletId: number | null = payment.walletId

      if (payment.walletId) {
        // Wallet-based payment - decrement the wallet
        const wallet = await tx.wallet.findUnique({
          where: { id: payment.walletId },
          select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
        })
        if (!wallet) throw new Error('Кошелёк не найден')

        balancesBefore = wallet

        const updatedWallet = await tx.wallet.update({
          where: { id: payment.walletId },
          data: {
            totalLessons: { decrement: payment.lessonCount },
            totalPayments: { decrement: payment.price },
            lessonsBalance: { decrement: payment.lessonCount },
          },
          select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
        })

        balancesAfter = updatedWallet
      } else {
        // Legacy payments without groupId - decrement global student balance
        const student = await tx.student.findUnique({
          where: { id: payment.studentId },
          select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
        })
        if (!student) throw new Error('Ученик не найден')

        balancesBefore = student

        const updated = await tx.student.update({
          where: { id: payment.studentId },
          data: {
            totalLessons: { decrement: payment.lessonCount },
            totalPayments: { decrement: payment.price },
            lessonsBalance: { decrement: payment.lessonCount },
          },
          select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
        })

        balancesAfter = updated
      }

      const commonMeta = {
        paymentId: payment.id,
        lessonCount: payment.lessonCount,
        price: payment.price,
        groupId: payment.groupId,
        walletId: payment.walletId,
      }

      const fields = [
        {
          field: StudentFinancialField.LESSONS_BALANCE,
          key: 'lessonsBalance' as const,
        },
        {
          field: StudentFinancialField.TOTAL_PAYMENTS,
          key: 'totalPayments' as const,
        },
        {
          field: StudentFinancialField.TOTAL_LESSONS,
          key: 'totalLessons' as const,
        },
      ]

      for (const f of fields) {
        const before = balancesBefore[f.key]
        const after = balancesAfter[f.key]
        await writeFinancialHistoryTx(tx, {
          organizationId: ctx.session.organizationId!,
          studentId: payment.studentId,
          actorUserId: Number(ctx.session.user.id),
          groupId: payment.groupId,
          walletId: resolvedWalletId,
          field: f.field,
          reason: StudentLessonsBalanceChangeReason.PAYMENT_CANCELLED,
          delta: after - before,
          balanceBefore: before,
          balanceAfter: after,
          meta: commonMeta,
        })
      }
    })
  })

export const getUnprocessedPayments = authAction
  .metadata({ actionName: 'getUnprocessedPayments' })
  .action(async ({ ctx }) => {
    return await prisma.unprocessedPayment.findMany({
      where: { organizationId: ctx.session.organizationId! },
      orderBy: { createdAt: 'desc' },
    })
  })

export const resolveUnprocessedPayment = authAction
  .metadata({ actionName: 'resolveUnprocessedPayment' })
  .inputSchema(ResolveUnprocessedPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const {
      unprocessedPaymentId,
      studentId,
      wallet: walletInput,
      lessonCount,
      price,
      date,
      paymentMethodId,
    } = parsedInput
    const walletId = walletInput.value

    const paymentMeta = {
      lessonCount,
      price,
      walletId,
      unprocessedPaymentId,
    }

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
        select: {
          lessonsBalance: true,
          totalPayments: true,
          totalLessons: true,
          organizationId: true,
          studentId: true,
        },
      })
      if (!wallet) throw new Error('Кошелёк не найден')
      if (wallet.studentId !== studentId) throw new Error('Кошелёк не принадлежит этому ученику')

      await tx.payment.create({
        data: {
          organizationId: wallet.organizationId,
          studentId,
          walletId,
          lessonCount,
          price,
          bidForLesson: Math.floor(price / lessonCount),
          date,
          paymentMethodId: paymentMethodId ?? null,
        },
      })

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: {
          lessonsBalance: { increment: lessonCount },
          totalLessons: { increment: lessonCount },
          totalPayments: { increment: price },
        },
        select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
      })

      await tx.unprocessedPayment.update({
        where: { id: unprocessedPaymentId, organizationId: ctx.session.organizationId! },
        data: { resolved: true },
      })

      const fields = [
        {
          field: StudentFinancialField.LESSONS_BALANCE,
          key: 'lessonsBalance' as const,
        },
        {
          field: StudentFinancialField.TOTAL_PAYMENTS,
          key: 'totalPayments' as const,
        },
        {
          field: StudentFinancialField.TOTAL_LESSONS,
          key: 'totalLessons' as const,
        },
      ]

      for (const f of fields) {
        await writeFinancialHistoryTx(tx, {
          organizationId: ctx.session.organizationId!,
          studentId,
          actorUserId: Number(ctx.session.user.id),
          walletId,
          field: f.field,
          reason: StudentLessonsBalanceChangeReason.PAYMENT_CREATED,
          delta: updated[f.key] - wallet[f.key],
          balanceBefore: wallet[f.key],
          balanceAfter: updated[f.key],
          meta: paymentMeta,
        })
      }
    })
  })

export const deleteUnprocessedPayment = authAction
  .metadata({ actionName: 'deleteUnprocessedPayment' })
  .inputSchema(DeleteUnprocessedPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.unprocessedPayment.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
