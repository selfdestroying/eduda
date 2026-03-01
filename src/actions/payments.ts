'use server'
import prisma from '@/src/lib/db/prisma'
import { writeFinancialHistoryTx } from '@/src/lib/lessons-balance'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Prisma, StudentLessonsBalanceChangeReason } from '../../prisma/generated/client'
import { StudentFinancialField } from '../../prisma/generated/enums'
import { auth } from '../lib/auth/server'
import { protocol, rootDomain } from '../lib/utils'

export type PaymentsWithStudentAndGroup = Prisma.PaymentGetPayload<{
  include: {
    student: true
    group: { include: { course: true; location: true } }
  }
}>

export const getPayments = async <T extends Prisma.PaymentFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.PaymentFindManyArgs>,
) => {
  return await prisma.payment.findMany<T>(payload)
}

export const createPayment = async (payload: Prisma.PaymentCreateArgs) => {
  await prisma.payment.create(payload)
  revalidatePath('/dashboard/finances/payments')
}

export const deletePayment = async (payload: Prisma.PaymentDeleteArgs) => {
  await prisma.payment.delete(payload)
  revalidatePath('/dashboard/finances/payments')
}

export const cancelPayment = async (payload: Prisma.PaymentDeleteArgs) => {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.delete(payload)

    // Determine where to decrement: per-group or global (legacy)
    const hasGroup = payment.groupId != null
    let balancesBefore: { lessonsBalance: number; totalPayments: number; totalLessons: number }
    let balancesAfter: { lessonsBalance: number; totalPayments: number; totalLessons: number }

    if (hasGroup) {
      const sg = await tx.studentGroup.findUnique({
        where: {
          studentId_groupId: { studentId: payment.studentId, groupId: payment.groupId! },
        },
        select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
      })
      if (!sg) throw new Error('Ученик не найден в группе')

      balancesBefore = sg

      const updatedSg = await tx.studentGroup.update({
        where: {
          studentId_groupId: { studentId: payment.studentId, groupId: payment.groupId! },
        },
        data: {
          totalLessons: { decrement: payment.lessonCount },
          totalPayments: { decrement: payment.price },
          lessonsBalance: { decrement: payment.lessonCount },
        },
        select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
      })

      balancesAfter = updatedSg
    } else {
      // Legacy payments without groupId — decrement global student balance
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
        organizationId: session.organizationId!,
        studentId: payment.studentId,
        actorUserId: Number(session.user.id),
        groupId: payment.groupId,
        field: f.field,
        reason: StudentLessonsBalanceChangeReason.PAYMENT_CANCELLED,
        delta: after - before,
        balanceBefore: before,
        balanceAfter: after,
        meta: commonMeta,
      })
    }
  })
  revalidatePath('/dashboard/finances/payments')
}

export const createPaymentProduct = async (payload: Prisma.PaymentProductCreateArgs) => {
  await prisma.paymentProduct.create(payload)
  revalidatePath('/dashboard/finances/payments')
}

export const deletePaymentProduct = async (payload: Prisma.PaymentProductDeleteArgs) => {
  await prisma.paymentProduct.delete(payload)
  revalidatePath('/dashboard/finances/payments')
}

export const getUnprocessedPayments = async <T extends Prisma.UnprocessedPaymentFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.UnprocessedPaymentFindManyArgs>,
) => {
  return await prisma.unprocessedPayment.findMany(payload)
}

export const updateUnprocessedPayment = async (payload: Prisma.UnprocessedPaymentUpdateArgs) => {
  await prisma.unprocessedPayment.update(payload)
  revalidatePath('/dashboard/finances/payments')
}

export const deleteUnprocessedPayment = async (payload: Prisma.UnprocessedPaymentDeleteArgs) => {
  await prisma.unprocessedPayment.delete(payload)
  revalidatePath('/dashboard/finances/payments')
}
