'use server'

import { prisma } from '@repo/db'
import { authAction } from '@/src/lib/safe-action'
import * as z from 'zod'
import {
  ArchiveWalletSchema,
  CreateWalletSchema,
  LinkGroupToWalletSchema,
  RenameWalletSchema,
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

// Экшенов правки, перевода баланса и объединения кошельков здесь нет намеренно:
// остаток кошелька — это то, что осталось от оплат после посещений, а не число,
// которому назначают значение. Единственный способ его изменить — завести оплату
// или отметить посещение.

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
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    })
  })
