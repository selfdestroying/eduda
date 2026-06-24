'use server'

import prisma from '@/src/lib/db/prisma'
import { NotFoundError } from '@/src/lib/error'
import { authAction } from '@/src/lib/safe-action'
import type { Prisma } from '@/prisma/generated/client'
import {
  AppendMessageSchema,
  InitializeThreadSchema,
  RemoteIdSchema,
  RenameThreadSchema,
} from './schemas'

// ─── READ ───────────────────────────────────────────────────────────

export const listThreads = authAction
  .metadata({ actionName: 'listThreads' })
  .action(async ({ ctx }) => {
    const threads = await prisma.assistantThread.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
      select: { remoteId: true, title: true, archived: true, lastMessageAt: true },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    })

    return threads.map((t) => ({
      remoteId: t.remoteId,
      title: t.title ?? undefined,
      archived: t.archived,
      lastMessageAt: t.lastMessageAt ?? undefined,
    }))
  })

export const fetchThread = authAction
  .metadata({ actionName: 'fetchThread' })
  .inputSchema(RemoteIdSchema)
  .action(async ({ ctx, parsedInput }) => {
    const thread = await prisma.assistantThread.findFirst({
      where: {
        remoteId: parsedInput.remoteId,
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
      select: { remoteId: true, title: true, archived: true, lastMessageAt: true },
    })

    if (!thread) throw new NotFoundError('Чат не найден')

    return {
      remoteId: thread.remoteId,
      title: thread.title ?? undefined,
      archived: thread.archived,
      lastMessageAt: thread.lastMessageAt ?? undefined,
    }
  })

export const loadMessages = authAction
  .metadata({ actionName: 'loadMessages' })
  .inputSchema(RemoteIdSchema)
  .action(async ({ ctx, parsedInput }) => {
    const thread = await prisma.assistantThread.findFirst({
      where: {
        remoteId: parsedInput.remoteId,
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
      select: { id: true },
    })

    if (!thread) return []

    const messages = await prisma.assistantMessage.findMany({
      where: { threadId: thread.id },
      select: { messageId: true, parentId: true, format: true, content: true },
      orderBy: { id: 'asc' },
    })

    return messages.map((m) => ({
      id: m.messageId,
      parent_id: m.parentId,
      format: m.format,
      content: m.content,
    }))
  })

// ─── WRITE ──────────────────────────────────────────────────────────

export const initializeThread = authAction
  .metadata({ actionName: 'initializeThread' })
  .inputSchema(InitializeThreadSchema)
  .action(async ({ ctx }) => {
    const thread = await prisma.assistantThread.create({
      data: {
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
      select: { remoteId: true },
    })

    return { remoteId: thread.remoteId }
  })

export const renameThread = authAction
  .metadata({ actionName: 'renameThread' })
  .inputSchema(RenameThreadSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.assistantThread.updateMany({
      where: {
        remoteId: parsedInput.remoteId,
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
      data: { title: parsedInput.title },
    })
  })

export const archiveThread = authAction
  .metadata({ actionName: 'archiveThread' })
  .inputSchema(RemoteIdSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.assistantThread.updateMany({
      where: {
        remoteId: parsedInput.remoteId,
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
      data: { archived: true },
    })
  })

export const unarchiveThread = authAction
  .metadata({ actionName: 'unarchiveThread' })
  .inputSchema(RemoteIdSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.assistantThread.updateMany({
      where: {
        remoteId: parsedInput.remoteId,
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
      data: { archived: false },
    })
  })

export const deleteThread = authAction
  .metadata({ actionName: 'deleteThread' })
  .inputSchema(RemoteIdSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.assistantThread.deleteMany({
      where: {
        remoteId: parsedInput.remoteId,
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
    })
  })

export const appendMessage = authAction
  .metadata({ actionName: 'appendMessage' })
  .inputSchema(AppendMessageSchema)
  .action(async ({ ctx, parsedInput }) => {
    const thread = await prisma.assistantThread.findFirst({
      where: {
        remoteId: parsedInput.remoteId,
        organizationId: ctx.session.organizationId!,
        userId: Number(ctx.session.user.id),
      },
      select: { id: true },
    })

    if (!thread) throw new NotFoundError('Чат не найден')

    const content = parsedInput.content as Prisma.InputJsonValue

    await prisma.$transaction([
      prisma.assistantMessage.upsert({
        where: { threadId_messageId: { threadId: thread.id, messageId: parsedInput.messageId } },
        create: {
          threadId: thread.id,
          messageId: parsedInput.messageId,
          parentId: parsedInput.parentId,
          format: parsedInput.format,
          content,
        },
        update: {
          parentId: parsedInput.parentId,
          format: parsedInput.format,
          content,
        },
      }),
      prisma.assistantThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: new Date() },
      }),
    ])
  })
