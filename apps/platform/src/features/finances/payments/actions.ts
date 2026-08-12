'use server'

import {
  StudentFinancialField,
  StudentLessonsBalanceChangeReason,
  WalletEntryKind,
} from '@repo/db/enums'
import { prisma } from '@repo/db'
import {
  recordWalletEntryTx,
  settleUnpaidAttendancesTx,
  writeFinancialHistoryTx,
} from '@/src/features/finances/ledger.server'
import { getWalletLabel } from '@/src/features/wallets/utils'
import { ConflictError, NotFoundError } from '@/src/lib/error'
import { dateToYmd, nowInTz, todayYmdInTz } from '@/src/lib/timezone'
import { permissionAction } from '@/src/lib/safe-action'
import { endOfMonth, startOfMonth } from 'date-fns'
import {
  CancelPaymentSchema,
  CreatePaymentSchema,
  DeleteUnprocessedPaymentSchema,
  PaymentListSchema,
  ResolveUnprocessedPaymentSchema,
} from './schemas'
import { PAYMENT_LIST_SELECT, type PaymentListItem, type StudentForPayment } from './types'

/**
 * Оплата закрывает накопившиеся неоплаченные занятия, а каждое из них — отдельное
 * списание со своим пакетом, журналом и историей. У ученика, который долго ходил
 * без оплаты, таких занятий десятки, и в дефолтные пять секунд Prisma длинный
 * хвост не укладывается: транзакция откатится целиком, и оплата не пройдёт вовсе.
 */
const PAYMENT_TX_OPTIONS = { timeout: 30_000 }

export const getPayments = permissionAction({ payment: ['read'] })
  .metadata({ actionName: 'getPayments' })
  .inputSchema(PaymentListSchema)
  .action(async ({ ctx, parsedInput }): Promise<PaymentListItem[]> => {
    // Границы включительные и сравниваются как строки: `date` — date-only колонка.
    // Без явного периода отдаём текущий месяц в поясе организации, а не всю историю.
    const now = nowInTz(ctx.tz)
    const from = parsedInput.from ?? dateToYmd(startOfMonth(now))
    const to = parsedInput.to ?? dateToYmd(endOfMonth(now))

    const payments = await prisma.payment.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
        date: { gte: from, lte: to },
      },
      select: PAYMENT_LIST_SELECT,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    })

    return payments.map(({ wallet, ...payment }) => ({
      ...payment,
      walletId: wallet?.id ?? null,
      walletLabel: wallet ? getWalletLabel(wallet) : null,
    }))
  })

export const getStudentsForPayments = permissionAction({ payment: ['create'] })
  .metadata({ actionName: 'getStudentsForPayments' })
  .action(async ({ ctx }): Promise<StudentForPayment[]> => {
    const students = await prisma.student.findMany({
      where: { organizationId: ctx.session.organizationId! },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        // Только активные: форма всё равно показывает лишь их, и фильтровать
        // выгоднее в БД, чем возить архив по сети.
        wallets: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            studentGroups: {
              select: {
                status: true,
                group: {
                  select: {
                    name: true,
                    course: { select: { name: true } },
                    schedules: { select: { dayOfWeek: true, time: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    return students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      wallets: s.wallets.map((w) => ({ id: w.id, label: getWalletLabel(w) })),
    }))
  })

export const createPaymentWithBalance = permissionAction({ payment: ['create'] })
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
      managerId,
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

      const payment = await tx.payment.create({
        select: { id: true },
        data: {
          organizationId: wallet.organizationId,
          studentId,
          walletId,
          lessonCount,
          price,
          bidForLesson: Math.floor(price / lessonCount),
          // Пакет встаёт в очередь кошелька целиком: посещения будут гасить его
          // с головы, пока остаток не кончится.
          remaining: lessonCount,
          date,
          paymentMethodId: paymentMethodId ?? null,
          managerId: managerId ?? null,
        },
      })

      // Журнал: оплата — приход уроков в кошелёк, встаёт в очередь по своей дате.
      await recordWalletEntryTx(tx, {
        organizationId: wallet.organizationId,
        walletId,
        studentId,
        kind: WalletEntryKind.PURCHASE,
        quantity: lessonCount,
        unitPrice: Math.floor(price / lessonCount),
        effectiveAt: date,
        paymentId: payment.id,
        actorUserId: Number(ctx.session.user.id),
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

      // Купленные уроки на балансе — теперь ими можно закрыть занятия, которые
      // школа уже провела, а платить за них было нечем. Списываются обычным
      // порядком, то есть по цене этого пакета.
      await settleUnpaidAttendancesTx(tx, {
        walletId,
        organizationId: ctx.session.organizationId!,
        paymentId: payment.id,
        take: lessonCount,
        actorUserId: Number(ctx.session.user.id),
      })
    }, PAYMENT_TX_OPTIONS)
  })

export const cancelPayment = permissionAction({ payment: ['delete'] })
  .metadata({ actionName: 'cancelPayment' })
  .inputSchema(CancelPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
        select: { status: true, remaining: true, lessonCount: true },
      })
      if (!existing) throw new NotFoundError('Оплата не найдена')
      if (existing.status === 'CANCELLED') throw new ConflictError('Оплата уже отменена')

      // Запись не удаляем: на неё ссылаются проводки проведённых занятий, и её
      // исчезновение переписало бы выручку прошлых месяцев. Пакет выбывает из очереди
      // обнулённым остатком, а сама оплата остаётся видна со статусом «отменена».
      const payment = await tx.payment.update({
        where: { id: parsedInput.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), remaining: 0 },
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

        // С баланса снимаем только непотраченный остаток пакета — тот, что был до
        // обнуления. Занятия, которые ученик уже отходил, списаны и оплачены;
        // вычитать их ещё раз значит увести человека в долг за посещения, которые
        // эта же оплата и закрыла. У оплат до разметки истории остатка нет.
        const unspent = existing.remaining ?? existing.lessonCount

        const updatedWallet = await tx.wallet.update({
          where: { id: payment.walletId },
          data: {
            totalLessons: { decrement: payment.lessonCount },
            totalPayments: { decrement: payment.price },
            lessonsBalance: { decrement: unspent },
          },
          select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
        })

        balancesAfter = updatedWallet

        // Журнал: снятие датируется днём отмены, а не днём оплаты — это новое
        // событие, а не переписывание старого.
        await recordWalletEntryTx(tx, {
          organizationId: ctx.session.organizationId!,
          walletId: payment.walletId,
          studentId: payment.studentId,
          kind: WalletEntryKind.CANCELLATION,
          quantity: -unspent,
          unitPrice: payment.lessonCount > 0 ? Math.floor(payment.price / payment.lessonCount) : 0,
          effectiveAt: todayYmdInTz(ctx.tz),
          paymentId: payment.id,
          actorUserId: Number(ctx.session.user.id),
          comment: 'Отмена оплаты: снят непотраченный остаток',
        })
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

export const getUnprocessedPayments = permissionAction({ payment: ['read'] })
  .metadata({ actionName: 'getUnprocessedPayments' })
  .action(async ({ ctx }) => {
    return await prisma.unprocessedPayment.findMany({
      where: { organizationId: ctx.session.organizationId! },
      orderBy: { createdAt: 'desc' },
    })
  })

// Разбор неразобранной оплаты создаёт настоящий `Payment` — право то же, что у
// создания вручную.
export const resolveUnprocessedPayment = permissionAction({ payment: ['create'] })
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
      managerId,
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

      const payment = await tx.payment.create({
        select: { id: true },
        data: {
          organizationId: wallet.organizationId,
          studentId,
          walletId,
          lessonCount,
          price,
          bidForLesson: Math.floor(price / lessonCount),
          // Пакет встаёт в очередь кошелька целиком: посещения будут гасить его
          // с головы, пока остаток не кончится.
          remaining: lessonCount,
          date,
          paymentMethodId: paymentMethodId ?? null,
          managerId: managerId ?? null,
        },
      })

      // Журнал: оплата — приход уроков в кошелёк, встаёт в очередь по своей дате.
      await recordWalletEntryTx(tx, {
        organizationId: wallet.organizationId,
        walletId,
        studentId,
        kind: WalletEntryKind.PURCHASE,
        quantity: lessonCount,
        unitPrice: Math.floor(price / lessonCount),
        effectiveAt: date,
        paymentId: payment.id,
        actorUserId: Number(ctx.session.user.id),
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

      // Купленные уроки на балансе — теперь ими можно закрыть занятия, которые
      // школа уже провела, а платить за них было нечем. Списываются обычным
      // порядком, то есть по цене этого пакета.
      await settleUnpaidAttendancesTx(tx, {
        walletId,
        organizationId: ctx.session.organizationId!,
        paymentId: payment.id,
        take: lessonCount,
        actorUserId: Number(ctx.session.user.id),
      })
    }, PAYMENT_TX_OPTIONS)
  })

export const deleteUnprocessedPayment = permissionAction({ payment: ['delete'] })
  .metadata({ actionName: 'deleteUnprocessedPayment' })
  .inputSchema(DeleteUnprocessedPaymentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.unprocessedPayment.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
