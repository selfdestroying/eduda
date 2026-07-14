'use server'

import prisma from '@/src/lib/db/prisma'
import { publicAction } from '@/src/lib/safe-action'
import { getAgeFromBirthDate } from '@/src/lib/utils'
import {
  ConfirmPublicActualitySchema,
  CreatePublicParentSchema,
  PublicChildSchema,
  PublicTokenSchema,
  UpdateOwnParentSchema,
  UpdatePublicParentSchema,
  UpdatePublicStudentSchema,
} from './schemas'

// ─── Helpers ────────────────────────────────────────────────────────

async function getParentByToken(token: string) {
  return prisma.parent.findUnique({
    where: { accessToken: token },
    select: { id: true, organizationId: true },
  })
}

async function getChildIds(parentId: number) {
  const links = await prisma.studentParent.findMany({
    where: { parentId },
    select: { studentId: true },
    orderBy: { createdAt: 'asc' },
  })
  return links.map((link) => link.studentId)
}

/**
 * Резолвит выбранного ребёнка по родительскому токену и проверяет, что ребёнок
 * принадлежит этому родителю. Бросает ошибку при невалидном токене / чужом ребёнке.
 */
async function resolveChild(token: string, studentId?: number) {
  const parent = await getParentByToken(token)
  if (!parent) throw new Error('Ссылка недействительна.')

  const childIds = await getChildIds(parent.id)
  const targetId = studentId ?? childIds[0]

  if (targetId === undefined) throw new Error('К профилю не привязаны дети.')
  if (!childIds.includes(targetId)) throw new Error('Нет доступа к данным этого ребёнка.')

  return { parentId: parent.id, organizationId: parent.organizationId, studentId: targetId }
}

// ─── Get cabinet data (родитель + дети) ─────────────────────────────

export const getCabinetData = publicAction
  .metadata({ actionName: 'getCabinetData' })
  .inputSchema(PublicTokenSchema)
  .action(async ({ parsedInput }) => {
    const parent = await prisma.parent.findUnique({
      where: { accessToken: parsedInput.token },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        organization: { select: { name: true } },
        students: {
          select: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!parent) return null

    return {
      organizationName: parent.organization.name,
      parent: {
        id: parent.id,
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone,
        email: parent.email,
      },
      children: parent.students.map(({ student }) => student),
    }
  })

// ─── Get child profile data ─────────────────────────────────────────

export const getPublicStudentData = publicAction
  .metadata({ actionName: 'getPublicStudentData' })
  .inputSchema(PublicChildSchema)
  .action(async ({ parsedInput }) => {
    const { studentId, organizationId } = await resolveChild(
      parsedInput.token,
      parsedInput.studentId,
    )

    const student = await prisma.student.findFirst({
      where: { id: studentId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        age: true,
        birthDate: true,
        dataActual: true,
        dataActualizedAt: true,
        parents: {
          include: {
            parent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!student) return null

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      age: student.age,
      birthDate: student.birthDate ?? null,
      dataActual: student.dataActual,
      dataActualizedAt: student.dataActualizedAt?.toISOString() ?? null,
      parents: student.parents.map(({ parent }) => parent),
    }
  })

// ─── Update own parent (запись токена) ──────────────────────────────

export const updateOwnParent = publicAction
  .metadata({ actionName: 'updateOwnParent' })
  .inputSchema(UpdateOwnParentSchema)
  .action(async ({ parsedInput }) => {
    const parent = await getParentByToken(parsedInput.token)
    if (!parent) throw new Error('Ссылка недействительна.')

    return prisma.parent.update({
      where: { id: parent.id },
      data: {
        firstName: parsedInput.firstName,
        lastName: parsedInput.lastName,
        phone: parsedInput.phone,
        email: parsedInput.email,
      },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    })
  })

// ─── Update student ─────────────────────────────────────────────────

export const updatePublicStudent = publicAction
  .metadata({ actionName: 'updatePublicStudent' })
  .inputSchema(UpdatePublicStudentSchema)
  .action(async ({ parsedInput }) => {
    const { studentId } = await resolveChild(parsedInput.token, parsedInput.studentId)

    const birthDate = parsedInput.birthDate

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        firstName: parsedInput.firstName,
        lastName: parsedInput.lastName,
        birthDate,
        age: birthDate ? getAgeFromBirthDate(birthDate) : null,
        dataActual: false,
        dataActualizedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        age: true,
        birthDate: true,
        dataActual: true,
        dataActualizedAt: true,
      },
    })

    return {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      age: updated.age,
      birthDate: updated.birthDate ?? null,
      dataActual: updated.dataActual,
      dataActualizedAt: updated.dataActualizedAt?.toISOString() ?? null,
    }
  })

// ─── Update parent (со-родитель ребёнка) ────────────────────────────

export const updatePublicParent = publicAction
  .metadata({ actionName: 'updatePublicParent' })
  .inputSchema(UpdatePublicParentSchema)
  .action(async ({ parsedInput }) => {
    const { studentId, organizationId } = await resolveChild(
      parsedInput.token,
      parsedInput.studentId,
    )

    const link = await prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId, parentId: parsedInput.parentId } },
      select: { parentId: true },
    })

    if (!link) throw new Error('Нельзя изменить эти данные по текущей ссылке.')

    const updated = await prisma.$transaction(async (tx) => {
      const parent = await tx.parent.update({
        where: { id: parsedInput.parentId, organizationId },
        data: {
          firstName: parsedInput.firstName,
          lastName: parsedInput.lastName,
          phone: parsedInput.phone,
          email: parsedInput.email,
        },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      })

      await tx.student.update({
        where: { id: studentId },
        data: { dataActual: false, dataActualizedAt: null },
      })

      return parent
    })

    return updated
  })

// ─── Create parent (добавить со-родителя к ребёнку) ─────────────────

export const createPublicParent = publicAction
  .metadata({ actionName: 'createPublicParent' })
  .inputSchema(CreatePublicParentSchema)
  .action(async ({ parsedInput }) => {
    const { studentId, organizationId } = await resolveChild(
      parsedInput.token,
      parsedInput.studentId,
    )

    const parent = await prisma.$transaction(async (tx) => {
      const created = await tx.parent.create({
        data: {
          firstName: parsedInput.firstName,
          lastName: parsedInput.lastName,
          phone: parsedInput.phone,
          email: parsedInput.email,
          organizationId,
        },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      })

      await tx.studentParent.create({
        data: {
          studentId,
          parentId: created.id,
        },
      })

      await tx.student.update({
        where: { id: studentId },
        data: { dataActual: false, dataActualizedAt: null },
      })

      return created
    })

    return parent
  })

// ─── Get student finances (read-only) ───────────────────────────────

export const getPublicStudentFinances = publicAction
  .metadata({ actionName: 'getPublicStudentFinances' })
  .inputSchema(PublicChildSchema)
  .action(async ({ parsedInput }) => {
    const { studentId } = await resolveChild(parsedInput.token, parsedInput.studentId)

    return prisma.student.findUnique({
      where: { id: studentId },
      select: {
        lessonsBalance: true,
        totalLessons: true,
        totalPayments: true,
        wallets: {
          select: {
            id: true,
            name: true,
            status: true,
            lessonsBalance: true,
            totalLessons: true,
            totalPayments: true,
            studentGroups: {
              select: {
                status: true,
                group: {
                  select: {
                    course: { select: { name: true } },
                    schedules: { select: { dayOfWeek: true, time: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          select: {
            id: true,
            date: true,
            productName: true,
            lessonCount: true,
            price: true,
            group: {
              select: {
                course: { select: { name: true } },
                schedules: { select: { dayOfWeek: true, time: true } },
              },
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    })
  })

// ─── Get student groups & attendance (read-only) ────────────────────

export const getPublicStudentGroups = publicAction
  .metadata({ actionName: 'getPublicStudentGroups' })
  .inputSchema(PublicChildSchema)
  .action(async ({ parsedInput }) => {
    const { studentId } = await resolveChild(parsedInput.token, parsedInput.studentId)

    return prisma.studentGroup.findMany({
      where: { studentId },
      select: {
        status: true,
        statusChangedAt: true,
        group: {
          select: {
            id: true,
            course: { select: { name: true } },
            location: { select: { name: true } },
            schedules: { select: { dayOfWeek: true, time: true } },
            lessons: {
              select: {
                id: true,
                date: true,
                time: true,
                attendance: {
                  where: { studentId },
                  select: { status: true, isWarned: true, isTrial: true, comment: true },
                },
              },
              orderBy: { date: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  })

// ─── Confirm actuality ──────────────────────────────────────────────

export const confirmPublicDataActuality = publicAction
  .metadata({ actionName: 'confirmPublicDataActuality' })
  .inputSchema(ConfirmPublicActualitySchema)
  .action(async ({ parsedInput }) => {
    const { studentId } = await resolveChild(parsedInput.token, parsedInput.studentId)

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { dataActual: true, dataActualizedAt: new Date() },
      select: { dataActualizedAt: true },
    })

    return {
      dataActual: true as const,
      dataActualizedAt: updated.dataActualizedAt!.toISOString(),
    }
  })
