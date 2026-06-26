'use server'

import { Prisma } from '@/prisma/generated/client'
import { StudentFinancialField, StudentLessonsBalanceChangeReason } from '@/prisma/generated/enums'
import prisma from '@/src/lib/db/prisma'
import {
  type StudentFinancialAudit,
  FINANCIAL_FIELD_KEY,
  parseIntFieldChange,
  writeFinancialHistoryTx,
} from '@/src/lib/lessons-balance'
import { authAction } from '@/src/lib/safe-action'
import { moscowNow } from '@/src/lib/timezone'
import * as z from 'zod'
import {
  ArchiveWalletSchema,
  CreateWalletSchema,
  LinkGroupToWalletSchema,
  MergeWalletsSchema,
  RenameWalletSchema,
  TransferWalletBalanceSchema,
  UpdateWalletBalanceSchema,
} from './schemas'

// ─── READ ────────────────────────────────────────────────────────────────────

export const getStudentWallets = authAction
  .metadata({ actionName: 'getStudentWallets' })
  .inputSchema(
    z.object({
      studentId: z.number().int().positive(),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.wallet.findMany({
      where: {
        studentId: parsedInput.studentId,
        organizationId: ctx.session.organizationId!,
      },
      include: {
        studentGroups: {
          include: {
            group: { include: { course: true, location: true, schedules: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  })

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const createWallet = authAction
  .metadata({ actionName: 'createWallet' })
  .inputSchema(CreateWalletSchema)
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.wallet.create({
      data: {
        studentId: parsedInput.studentId,
        organizationId: ctx.session.organizationId!,
        name: parsedInput.name ?? null,
      },
    })
  })

// ─── UPDATE BALANCE ──────────────────────────────────────────────────────────

export const updateWalletBalance = authAction
  .metadata({ actionName: 'updateWalletBalance' })
  .inputSchema(UpdateWalletBalanceSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { walletId } = parsedInput
    const data = parsedInput.data as {
      lessonsBalance?: Prisma.IntFieldUpdateOperationsInput | number
      totalLessons?: Prisma.IntFieldUpdateOperationsInput | number
      totalPayments?: Prisma.IntFieldUpdateOperationsInput | number
    }
    const audit = parsedInput.audit as StudentFinancialAudit

    const financialFields = [
      StudentFinancialField.LESSONS_BALANCE,
      StudentFinancialField.TOTAL_PAYMENTS,
      StudentFinancialField.TOTAL_LESSONS,
    ] as const

    const changes = financialFields
      .map((field) => {
        const key = FINANCIAL_FIELD_KEY[field]
        const change = parseIntFieldChange(data[key] as Prisma.StudentUpdateInput['lessonsBalance'])
        return change ? { field, key, change } : null
      })
      .filter(Boolean) as {
      field: StudentFinancialField
      key: 'lessonsBalance' | 'totalPayments' | 'totalLessons'
      change: NonNullable<ReturnType<typeof parseIntFieldChange>>
    }[]

    if (changes.length === 0) return

    for (const c of changes) {
      if (!audit[c.field]) {
        throw new Error(`Для изменения поля ${c.key} требуется указать причину (audit.${c.field})`)
      }
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
          status: true,
        },
      })
      if (!wallet) throw new Error('Кошелёк не найден')
      if (wallet.status === 'ARCHIVED') {
        throw new Error('Архивный кошелёк нельзя редактировать')
      }

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data,
        select: { lessonsBalance: true, totalPayments: true, totalLessons: true },
      })

      for (const c of changes) {
        const fieldAudit = audit[c.field]!
        const balanceBefore = wallet[c.key]
        const balanceAfter = updated[c.key]
        const delta = balanceAfter - balanceBefore

        await writeFinancialHistoryTx(tx, {
          organizationId: ctx.session.organizationId!,
          studentId: wallet.studentId,
          actorUserId: Number(ctx.session.user.id),
          walletId,
          field: c.field,
          reason: fieldAudit.reason,
          delta,
          balanceBefore,
          balanceAfter,
          comment: fieldAudit.comment,
          meta: fieldAudit.meta,
        })
      }
    })
  })

// ─── MERGE WALLETS ───────────────────────────────────────────────────────────

export const mergeWallets = authAction
  .metadata({ actionName: 'mergeWallets' })
  .inputSchema(MergeWalletsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { sourceWalletId, targetWalletId } = parsedInput

    await prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.wallet.findUnique({
          where: { id: sourceWalletId },
          select: {
            id: true,
            studentId: true,
            organizationId: true,
            lessonsBalance: true,
            totalLessons: true,
            totalPayments: true,
            status: true,
          },
        }),
        tx.wallet.findUnique({
          where: { id: targetWalletId },
          select: {
            id: true,
            studentId: true,
            organizationId: true,
            lessonsBalance: true,
            totalLessons: true,
            totalPayments: true,
            status: true,
          },
        }),
      ])

      if (!source) throw new Error('Кошелёк-источник не найден')
      if (!target) throw new Error('Кошелёк-приёмник не найден')
      if (source.studentId !== target.studentId) {
        throw new Error('Кошельки должны принадлежать одному ученику')
      }
      if (source.status === 'ARCHIVED' || target.status === 'ARCHIVED') {
        throw new Error('Архивный кошелёк нельзя объединять')
      }

      // Sum balances into target
      const updated = await tx.wallet.update({
        where: { id: targetWalletId },
        data: {
          lessonsBalance: { increment: source.lessonsBalance },
          totalLessons: { increment: source.totalLessons },
          totalPayments: { increment: source.totalPayments },
        },
        select: { lessonsBalance: true, totalLessons: true, totalPayments: true },
      })

      // Reassign StudentGroups
      await tx.studentGroup.updateMany({
        where: { walletId: sourceWalletId },
        data: { walletId: targetWalletId },
      })

      // Reassign Payments
      await tx.payment.updateMany({
        where: { walletId: sourceWalletId },
        data: { walletId: targetWalletId },
      })

      // Reassign balance history
      await tx.studentLessonsBalanceHistory.updateMany({
        where: { walletId: sourceWalletId },
        data: { walletId: targetWalletId },
      })

      // Delete source wallet
      await tx.wallet.delete({ where: { id: sourceWalletId } })

      // Audit trail for target (credit)
      const fields = [
        { field: StudentFinancialField.LESSONS_BALANCE, key: 'lessonsBalance' as const },
        { field: StudentFinancialField.TOTAL_LESSONS, key: 'totalLessons' as const },
        { field: StudentFinancialField.TOTAL_PAYMENTS, key: 'totalPayments' as const },
      ]

      for (const f of fields) {
        const delta = source[f.key]
        if (delta === 0) continue

        await writeFinancialHistoryTx(tx, {
          organizationId: ctx.session.organizationId!,
          studentId: target.studentId,
          actorUserId: Number(ctx.session.user.id),
          walletId: targetWalletId,
          field: f.field,
          reason: StudentLessonsBalanceChangeReason.WALLET_MERGED,
          delta,
          balanceBefore: updated[f.key] - delta,
          balanceAfter: updated[f.key],
          comment: `Объединение кошельков (источник #${sourceWalletId})`,
        })
      }
    })
  })

// ─── TRANSFER BALANCE ────────────────────────────────────────────────────────

export const transferWalletBalance = authAction
  .metadata({ actionName: 'transferWalletBalance' })
  .inputSchema(TransferWalletBalanceSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { sourceWalletId, targetWalletId, lessonsBalance, totalLessons, totalPayments } =
      parsedInput

    if (lessonsBalance === 0 && totalLessons === 0 && totalPayments === 0) {
      throw new Error('Укажите сумму для перевода')
    }

    await prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.wallet.findUnique({
          where: { id: sourceWalletId },
          select: {
            id: true,
            studentId: true,
            lessonsBalance: true,
            totalLessons: true,
            totalPayments: true,
            status: true,
          },
        }),
        tx.wallet.findUnique({
          where: { id: targetWalletId },
          select: {
            id: true,
            studentId: true,
            lessonsBalance: true,
            totalLessons: true,
            totalPayments: true,
            status: true,
          },
        }),
      ])

      if (!source) throw new Error('Кошелёк-источник не найден')
      if (!target) throw new Error('Кошелёк-приёмник не найден')
      if (source.studentId !== target.studentId) {
        throw new Error('Кошельки должны принадлежать одному ученику')
      }
      if (source.status === 'ARCHIVED' || target.status === 'ARCHIVED') {
        throw new Error('Архивный кошелёк нельзя использовать для перевода')
      }

      if (lessonsBalance > source.lessonsBalance) {
        throw new Error('Недостаточно уроков на балансе')
      }
      if (totalLessons > source.totalLessons) {
        throw new Error('Недостаточно всего уроков')
      }
      if (totalPayments > source.totalPayments) {
        throw new Error('Недостаточно суммы оплат')
      }

      const updateData: Prisma.WalletUpdateInput = {}
      const decrementData: Prisma.WalletUpdateInput = {}

      if (lessonsBalance > 0) {
        updateData.lessonsBalance = { increment: lessonsBalance }
        decrementData.lessonsBalance = { decrement: lessonsBalance }
      }
      if (totalLessons > 0) {
        updateData.totalLessons = { increment: totalLessons }
        decrementData.totalLessons = { decrement: totalLessons }
      }
      if (totalPayments > 0) {
        updateData.totalPayments = { increment: totalPayments }
        decrementData.totalPayments = { decrement: totalPayments }
      }

      const [updatedSource, updatedTarget] = await Promise.all([
        tx.wallet.update({ where: { id: sourceWalletId }, data: decrementData }),
        tx.wallet.update({ where: { id: targetWalletId }, data: updateData }),
      ])

      const fields = [
        {
          field: StudentFinancialField.LESSONS_BALANCE,
          key: 'lessonsBalance' as const,
          amount: lessonsBalance,
        },
        {
          field: StudentFinancialField.TOTAL_LESSONS,
          key: 'totalLessons' as const,
          amount: totalLessons,
        },
        {
          field: StudentFinancialField.TOTAL_PAYMENTS,
          key: 'totalPayments' as const,
          amount: totalPayments,
        },
      ]

      for (const f of fields) {
        if (f.amount === 0) continue

        // Debit from source
        await writeFinancialHistoryTx(tx, {
          organizationId: ctx.session.organizationId!,
          studentId: source.studentId,
          actorUserId: Number(ctx.session.user.id),
          walletId: sourceWalletId,
          field: f.field,
          reason: StudentLessonsBalanceChangeReason.WALLET_TRANSFER,
          delta: -f.amount,
          balanceBefore: source[f.key],
          balanceAfter: updatedSource[f.key],
          comment: `Перевод в кошелёк #${targetWalletId}`,
        })

        // Credit to target
        await writeFinancialHistoryTx(tx, {
          organizationId: ctx.session.organizationId!,
          studentId: target.studentId,
          actorUserId: Number(ctx.session.user.id),
          walletId: targetWalletId,
          field: f.field,
          reason: StudentLessonsBalanceChangeReason.WALLET_TRANSFER,
          delta: f.amount,
          balanceBefore: target[f.key],
          balanceAfter: updatedTarget[f.key],
          comment: `Перевод из кошелька #${sourceWalletId}`,
        })
      }
    })
  })

// ─── RENAME ──────────────────────────────────────────────────────────────────

export const renameWallet = authAction
  .metadata({ actionName: 'renameWallet' })
  .inputSchema(RenameWalletSchema)
  .action(async ({ ctx, parsedInput }) => {
    const wallet = await prisma.wallet.findUnique({
      where: { id: parsedInput.walletId, organizationId: ctx.session.organizationId! },
      select: { id: true, status: true },
    })
    if (!wallet) throw new Error('Кошелёк не найден')
    if (wallet.status === 'ARCHIVED') {
      throw new Error('Архивный кошелёк нельзя переименовать')
    }

    return await prisma.wallet.update({
      where: { id: parsedInput.walletId },
      data: { name: parsedInput.name || null },
    })
  })

// ─── LINK GROUP ──────────────────────────────────────────────────────────────

export const linkGroupToWallet = authAction
  .metadata({ actionName: 'linkGroupToWallet' })
  .inputSchema(LinkGroupToWalletSchema)
  .action(async ({ parsedInput }) => {
    const { studentId, groupId, walletId } = parsedInput

    // Validate wallet belongs to same student
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      select: { studentId: true, organizationId: true, status: true },
    })
    if (!wallet) throw new Error('Кошелёк не найден')
    if (wallet.studentId !== studentId) {
      throw new Error('Кошелёк не принадлежит этому ученику')
    }
    if (wallet.status === 'ARCHIVED') {
      throw new Error('К архивному кошельку нельзя привязать группу')
    }

    await prisma.studentGroup.update({
      where: {
        studentId_groupId: { studentId, groupId },
      },
      data: { walletId },
    })
  })

// ─── ARCHIVE ─────────────────────────────────────────────────────────────────

export const archiveWallet = authAction
  .metadata({ actionName: 'archiveWallet' })
  .inputSchema(ArchiveWalletSchema)
  .action(async ({ ctx, parsedInput }) => {
    const wallet = await prisma.wallet.findUnique({
      where: { id: parsedInput.walletId, organizationId: ctx.session.organizationId! },
      select: { id: true, status: true },
    })

    if (!wallet) throw new Error('Кошелёк не найден')
    if (wallet.status === 'ARCHIVED') {
      throw new Error('Кошелёк уже в архиве')
    }

    await prisma.wallet.update({
      where: { id: parsedInput.walletId },
      data: { status: 'ARCHIVED', archivedAt: moscowNow() },
    })
  })
