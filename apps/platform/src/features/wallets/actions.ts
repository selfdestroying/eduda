'use server'

import { prisma } from '@repo/db'
import { countUnpaidAttendancesOfWallet } from '@/src/features/finances/ledger.server'
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
      // Только активные: всем четырём потребителям — форме оплаты, посещаемости,
      // зачислению в группу и привязке группы — нужны именно они, и каждый
      // отсеивал архивные у себя. Одно условие в базе вместо четырёх в браузерах.
      where: {
        studentId: parsedInput.studentId,
        organizationId: ctx.session.organizationId!,
        status: 'ACTIVE',
      },
      include: {
        // Свежая запись первой: предпросмотр кошелька в свёрнутом виде показывает
        // одну строку, и это должна быть та группа, где ученик был последним, а не
        // та, куда его записали первой.
        //
        // Сортируем по `statusChangedAt`, а не по `createdAt`: возврат в группу, где
        // ученик уже был, не создаёт строку, а обновляет прежнюю (см. перевод в
        // `groups/actions.ts`). У «зачислили в A → перевели в B → вернули в A и
        // завершили» `createdAt` у A так и остался днём первого зачисления, и по нему
        // первой встала бы давно покинутая B.
        //
        // `createdAt` — второй ключ: `statusChangedAt` это день, без времени, а
        // перевод меняет статус обеим записям одним днём. Внутри дня свежей считается
        // та, что заведена позже, — то есть новая группа, а не покинутая.
        studentGroups: {
          include: {
            group: { include: { course: true, location: true, schedules: true } },
          },
          orderBy: [{ statusChangedAt: 'desc' }, { createdAt: 'desc' }],
        },
        // Пакеты кошелька — для предпросмотра в форме оплаты. Без ограничения:
        // предпросмотр разворачивается и показывает их все, а запрос и так идёт по
        // кошелькам одного ученика — это десятки узких строк, не тысячи. Отменённые
        // в эту картину не входят: их остаток уже снят с баланса. Неоплаченные тоже:
        // уроков они пока не дали.
        packages: {
          where: { status: 'ACTIVE' },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          select: { id: true, date: true, price: true, lessonCount: true, remaining: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  })

/**
 * Сколько занятий кошелька ждёт оплаты. Отдельным экшеном, а не полем в списке
 * кошельков: считать это нужно только форме оплаты и только для выбранного
 * кошелька, а список тянут ещё три экрана, которым счётчик не нужен.
 */
export const getWalletUnpaidCount = authAction
  .metadata({ actionName: 'getWalletUnpaidCount' })
  .inputSchema(z.object({ walletId: z.number().int().positive() }))
  .action(async ({ ctx, parsedInput }) => {
    return await countUnpaidAttendancesOfWallet({
      walletId: parsedInput.walletId,
      organizationId: ctx.session.organizationId!,
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
