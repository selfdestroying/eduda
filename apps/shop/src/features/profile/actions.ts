'use server'

import { NotFoundError } from '@/src/lib/error'
import { studentAction } from '@/src/lib/safe-action'
import { getGroupName } from '@/src/lib/utils'
import { prisma } from '@repo/db'

/**
 * Профиль ученика. Выборка ЯВНАЯ: `Student.editToken` и `Parent.accessToken` —
 * ключи от контура актуализации данных, и в кабинет они не попадают ни на одном
 * уровне вложенности (§11.10).
 */
export const getProfile = studentAction
  .metadata({ actionName: 'getProfile' })
  .action(async ({ ctx }) => {
    const student = await prisma.student.findFirst({
      where: { id: ctx.student.id, organizationId: ctx.student.organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        account: { select: { coins: true } },
        parents: {
          select: {
            parent: {
              select: { firstName: true, lastName: true, phone: true, email: true },
            },
          },
        },
        groups: {
          select: {
            status: true,
            group: {
              select: {
                id: true,
                name: true,
                course: { select: { name: true } },
                schedules: { select: { dayOfWeek: true, time: true } },
              },
            },
          },
        },
      },
    })

    if (!student) {
      throw new NotFoundError('Ученик не найден')
    }

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        birthDate: student.birthDate,
      },
      groups: student.groups.map((sg) => ({
        id: sg.group.id,
        name: getGroupName(sg.group),
        course: sg.group.course.name,
        status: sg.status,
      })),
      parents: student.parents.map((sp) => sp.parent),
      coins: student.account?.coins ?? 0,
    }
  })
