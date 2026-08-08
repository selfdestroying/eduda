'use server'

import { prisma } from '@repo/db'
import { authAction } from '@/src/lib/safe-action'
import { touchStudentData } from '@/src/lib/student-data'
import {
  CreateParentSchema,
  DeleteParentSchema,
  LinkParentSchema,
  UnlinkParentSchema,
  UpdateParentSchema,
} from './schemas'

// ─── READ ────────────────────────────────────────────────────────────────────

export const getParents = authAction
  .metadata({ actionName: 'getParents' })
  .action(async ({ ctx }) => {
    return await prisma.parent.findMany({
      where: { organizationId: ctx.session.organizationId! },
      include: { students: { include: { student: true } } },
      orderBy: { firstName: 'asc' },
    })
  })

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const createParent = authAction
  .metadata({ actionName: 'createParent' })
  .inputSchema(CreateParentSchema)
  .action(async ({ ctx, parsedInput }) => {
    return await prisma.parent.create({
      data: {
        ...parsedInput,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export const updateParent = authAction
  .metadata({ actionName: 'updateParent' })
  .inputSchema(UpdateParentSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, ...data } = parsedInput

    return await prisma.$transaction(async (tx) => {
      const parent = await tx.parent.update({
        where: { id, organizationId: ctx.session.organizationId! },
        data,
      })

      // Контакты родителя — часть анкеты ребёнка, поэтому правка двигает дату
      // актуальности у всех его детей.
      const links = await tx.studentParent.findMany({
        where: { parentId: id },
        select: { studentId: true },
      })
      await touchStudentData(
        tx,
        links.map((link) => link.studentId),
      )

      return parent
    })
  })

// ─── DELETE ──────────────────────────────────────────────────────────────────

export const deleteParent = authAction
  .metadata({ actionName: 'deleteParent' })
  .inputSchema(DeleteParentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.parent.delete({
      where: {
        id: parsedInput.id,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

// ─── LINK / UNLINK ───────────────────────────────────────────────────────────

export const linkParentToStudent = authAction
  .metadata({ actionName: 'linkParentToStudent' })
  .inputSchema(LinkParentSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.$transaction(async (tx) => {
      await tx.studentParent.create({
        data: {
          studentId: parsedInput.studentId,
          parentId: parsedInput.parentId,
          organizationId: ctx.session.organizationId!,
        },
      })
      // Появился новый контакт — набор контактов ребёнка изменился.
      await touchStudentData(tx, [parsedInput.studentId])
    })
  })

export const unlinkParentFromStudent = authAction
  .metadata({ actionName: 'unlinkParentFromStudent' })
  .inputSchema(UnlinkParentSchema)
  .action(async ({ parsedInput }) => {
    await prisma.$transaction(async (tx) => {
      await tx.studentParent.delete({
        where: {
          studentId_parentId: {
            studentId: parsedInput.studentId,
            parentId: parsedInput.parentId,
          },
        },
      })
      await touchStudentData(tx, [parsedInput.studentId])
    })
  })
