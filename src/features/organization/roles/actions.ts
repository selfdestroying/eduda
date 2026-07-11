'use server'

import prisma from '@/src/lib/db/prisma'
import { ConflictError, ForbiddenError, NotFoundError } from '@/src/lib/error'
import { modulesToPermission } from '@/src/lib/permissions/modules'
import {
  fullPermission,
  getStaticRolePermission,
  IMMUTABLE_ROLES,
  type OrganizationPermissionCheck,
  SYSTEM_ROLES,
  systemRoleLabels,
} from '@/src/lib/permissions/organization'
import { permissionAction } from '@/src/lib/safe-action'
import {
  CreateRoleSchema,
  DeleteRoleSchema,
  UpdateRoleInfoSchema,
  UpdateRoleSchema,
} from './schemas'
import type { AssignableRole, RoleDTO } from './types'

const SYSTEM_ROLE_LIST = SYSTEM_ROLES as readonly string[]
const IMMUTABLE_ROLE_LIST = IMMUTABLE_ROLES as readonly string[]

function parsePermission(json: string): OrganizationPermissionCheck {
  try {
    return JSON.parse(json) as OrganizationPermissionCheck
  } catch {
    return {}
  }
}

/** Полный список ролей (системные + кастомные) для страницы управления. */
export const getRoles = permissionAction({ role: ['read'] })
  .metadata({ actionName: 'getRoles' })
  .action(async ({ ctx }): Promise<RoleDTO[]> => {
    const orgId = ctx.session.organizationId!

    const [dbRoles, counts] = await Promise.all([
      prisma.organizationRole.findMany({ where: { organizationId: orgId } }),
      prisma.member.groupBy({
        by: ['role'],
        where: { organizationId: orgId },
        _count: { _all: true },
      }),
    ])

    const countByRole = new Map(counts.map((c) => [c.role, c._count._all]))
    const dbByRole = new Map(dbRoles.map((r) => [r.role, r]))

    const result: RoleDTO[] = []

    // Системные роли — в фиксированном порядке, всегда присутствуют.
    for (const role of SYSTEM_ROLES) {
      const db = dbByRole.get(role)
      const permission =
        role === 'owner'
          ? fullPermission
          : db
            ? parsePermission(db.permission)
            : (getStaticRolePermission(role) ?? {})

      result.push({
        role,
        label: db?.label ?? systemRoleLabels[role],
        permission,
        isSystem: true,
        immutable: IMMUTABLE_ROLE_LIST.includes(role),
        persisted: role === 'owner' ? true : !!db,
        memberCount: countByRole.get(role) ?? 0,
      })
      dbByRole.delete(role)
    }

    // Кастомные роли.
    for (const db of dbByRole.values()) {
      result.push({
        role: db.role,
        label: db.label ?? db.role,
        permission: parsePermission(db.permission),
        isSystem: false,
        immutable: false,
        persisted: true,
        memberCount: countByRole.get(db.role) ?? 0,
      })
    }

    return result
  })

/** Лёгкий список ролей для назначения участнику (без owner). */
export const getAssignableRoles = permissionAction({ member: ['read'] })
  .metadata({ actionName: 'getAssignableRoles' })
  .action(async ({ ctx }): Promise<AssignableRole[]> => {
    const orgId = ctx.session.organizationId!
    const dbRoles = await prisma.organizationRole.findMany({
      where: { organizationId: orgId },
      select: { role: true, label: true },
    })
    const dbByRole = new Map(dbRoles.map((r) => [r.role, r.label]))

    const result: AssignableRole[] = []
    for (const role of ['manager', 'teacher'] as const) {
      result.push({ role, label: dbByRole.get(role) ?? systemRoleLabels[role] })
      dbByRole.delete(role)
    }
    dbByRole.delete('owner')
    for (const [role, label] of dbByRole) {
      result.push({ role, label: label ?? role })
    }
    return result
  })

export const createRole = permissionAction({ role: ['create'] })
  .metadata({ actionName: 'createRole' })
  .inputSchema(CreateRoleSchema)
  .action(async ({ ctx, parsedInput }) => {
    const orgId = ctx.session.organizationId!
    const existing = await prisma.organizationRole.findUnique({
      where: { organizationId_role: { organizationId: orgId, role: parsedInput.role } },
    })
    if (existing) throw new ConflictError('Роль с таким идентификатором уже существует')

    await prisma.organizationRole.create({
      data: {
        organizationId: orgId,
        role: parsedInput.role,
        label: parsedInput.label,
        permission: JSON.stringify(modulesToPermission(parsedInput.modules)),
        isSystem: false,
      },
    })
  })

export const updateRole = permissionAction({ role: ['update'] })
  .metadata({ actionName: 'updateRole' })
  .inputSchema(UpdateRoleSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (IMMUTABLE_ROLE_LIST.includes(parsedInput.role)) {
      throw new ForbiddenError('Эту роль нельзя изменять')
    }
    const orgId = ctx.session.organizationId!
    const isSystem = SYSTEM_ROLE_LIST.includes(parsedInput.role)
    const permission = JSON.stringify(modulesToPermission(parsedInput.modules))

    // Кастомная роль должна существовать; системную (manager/teacher) материализуем.
    if (!isSystem) {
      const existing = await prisma.organizationRole.findUnique({
        where: { organizationId_role: { organizationId: orgId, role: parsedInput.role } },
      })
      if (!existing) throw new NotFoundError('Роль не найдена')
    }

    await prisma.organizationRole.upsert({
      where: { organizationId_role: { organizationId: orgId, role: parsedInput.role } },
      update: { label: parsedInput.label, permission },
      create: {
        organizationId: orgId,
        role: parsedInput.role,
        label: parsedInput.label,
        permission,
        isSystem,
      },
    })
  })

/**
 * Редактирование названия и идентификатора роли.
 * Идентификатор системной роли неизменяем. Переименование кастомной роли
 * атомарно переносит всех её участников (`Member.role`) на новый slug.
 */
export const updateRoleInfo = permissionAction({ role: ['update'] })
  .metadata({ actionName: 'updateRoleInfo' })
  .inputSchema(UpdateRoleInfoSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (IMMUTABLE_ROLE_LIST.includes(parsedInput.role)) {
      throw new ForbiddenError('Эту роль нельзя изменять')
    }
    const orgId = ctx.session.organizationId!
    const isSystem = SYSTEM_ROLE_LIST.includes(parsedInput.role)
    const renaming = !!parsedInput.newRole && parsedInput.newRole !== parsedInput.role

    if (renaming && isSystem) {
      throw new ForbiddenError('Идентификатор системной роли изменить нельзя')
    }

    const existing = await prisma.organizationRole.findUnique({
      where: { organizationId_role: { organizationId: orgId, role: parsedInput.role } },
    })
    // Права сохраняем как есть; для системной роли без строки берём статический дефолт.
    const permission =
      existing?.permission ?? JSON.stringify(getStaticRolePermission(parsedInput.role) ?? {})

    if (renaming) {
      const newRole = parsedInput.newRole!
      if (SYSTEM_ROLE_LIST.includes(newRole)) {
        throw new ConflictError('Этот идентификатор зарезервирован системной ролью')
      }
      const clash = await prisma.organizationRole.findUnique({
        where: { organizationId_role: { organizationId: orgId, role: newRole } },
      })
      if (clash) throw new ConflictError('Роль с таким идентификатором уже существует')

      await prisma.$transaction([
        existing
          ? prisma.organizationRole.update({
              where: { id: existing.id },
              data: { role: newRole, label: parsedInput.label },
            })
          : prisma.organizationRole.create({
              data: {
                organizationId: orgId,
                role: newRole,
                label: parsedInput.label,
                permission,
                isSystem: false,
              },
            }),
        prisma.member.updateMany({
          where: { organizationId: orgId, role: parsedInput.role },
          data: { role: newRole },
        }),
      ])
      return
    }

    // Меняем только название (для manager/teacher материализуем строку).
    await prisma.organizationRole.upsert({
      where: { organizationId_role: { organizationId: orgId, role: parsedInput.role } },
      update: { label: parsedInput.label },
      create: {
        organizationId: orgId,
        role: parsedInput.role,
        label: parsedInput.label,
        permission,
        isSystem,
      },
    })
  })

export const deleteRole = permissionAction({ role: ['delete'] })
  .metadata({ actionName: 'deleteRole' })
  .inputSchema(DeleteRoleSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (SYSTEM_ROLE_LIST.includes(parsedInput.role)) {
      throw new ForbiddenError('Системную роль нельзя удалить')
    }
    const orgId = ctx.session.organizationId!
    const memberCount = await prisma.member.count({
      where: { organizationId: orgId, role: parsedInput.role },
    })
    if (memberCount > 0) {
      throw new ConflictError('Нельзя удалить роль, назначенную участникам')
    }
    await prisma.organizationRole.deleteMany({
      where: { organizationId: orgId, role: parsedInput.role },
    })
  })
