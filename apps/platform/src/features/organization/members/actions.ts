'use server'

import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { authAction } from '@/src/lib/safe-action'
import { headers } from 'next/headers'
import { z } from 'zod'
import {
  CreateMemberSchema,
  CreatePaycheckSchema,
  DeletePaycheckSchema,
  UpdateMemberSchema,
  UpdatePaycheckSchema,
} from './schemas'

// ─── Inline schemas for simple ID-based inputs ──────────────────────
const UserIdSchema = z.object({ userId: z.number().int().positive() })
const CreatePaycheckWithUserSchema = CreatePaycheckSchema.extend({
  userId: z.number().int().positive(),
})

// ─── Members ────────────────────────────────────────────────────────

export const getMembers = authAction
  .metadata({ actionName: 'getMembers' })
  .action(async ({ ctx }) => {
    return await prisma.member.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
      },
      include: { user: true },
      orderBy: { userId: 'asc' },
    })
  })

export const getMemberById = authAction
  .metadata({ actionName: 'getMemberById' })
  .inputSchema(UserIdSchema)
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.member.findFirst({
      where: {
        userId: parsedInput.userId,
        organizationId: ctx.session.organizationId!,
      },
      include: { user: true },
    })
  })

export const createMember = authAction
  .metadata({ actionName: 'createMember' })
  .inputSchema(CreateMemberSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { firstName, lastName, email, password, role } = parsedInput
    const requestHeaders = await headers()

    const newUser = await auth.api.createUser({
      headers: requestHeaders,
      body: {
        email,
        password,
        name: `${firstName} ${lastName}`,
        role: 'user',
        data: { firstName, lastName },
      },
    })

    await auth.api.addMember({
      body: {
        userId: newUser.user.id,
        organizationId: ctx.session.organizationId!.toString(),
        // Dynamic AC: роль может быть кастомной (строка из OrganizationRole),
        // better-auth принимает её в рантайме, тип статичен.
        role: role as 'owner' | 'manager' | 'teacher',
      },
    })
  })

export const updateMember = authAction
  .metadata({ actionName: 'updateMember' })
  .inputSchema(UpdateMemberSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { memberId, userId, firstName, lastName, role, banned } = parsedInput
    const requestHeaders = await headers()

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: `${firstName} ${lastName || ''}`.trim(),
        banned,
      },
    })

    await auth.api.updateMemberRole({
      headers: requestHeaders,
      body: {
        memberId: memberId.toString(),
        role: role.value,
        organizationId: ctx.session.organizationId!.toString(),
      },
    })
  })

// ─── Paychecks ──────────────────────────────────────────────────────

export const getPaychecksByUser = authAction
  .metadata({ actionName: 'getPaychecksByUser' })
  .inputSchema(UserIdSchema)
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.payCheck.findMany({
      where: {
        userId: parsedInput.userId,
        organizationId: ctx.session.organizationId!,
      },
      orderBy: { date: 'asc' },
    })
  })

export const createPaycheck = authAction
  .metadata({ actionName: 'createPaycheck' })
  .inputSchema(CreatePaycheckWithUserSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { userId, ...data } = parsedInput
    await prisma.payCheck.create({
      data: {
        ...data,
        userId,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updatePaycheck = authAction
  .metadata({ actionName: 'updatePaycheck' })
  .inputSchema(UpdatePaycheckSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput
    await prisma.payCheck.update({
      where: { id, organizationId: ctx.session.organizationId! },
      data,
    })
  })

export const deletePaycheck = authAction
  .metadata({ actionName: 'deletePaycheck' })
  .inputSchema(DeletePaycheckSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.payCheck.delete({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
    })
  })
