/**
 * Реестр модулей доступа — «человеко-понятный» слой над гранулярными
 * AC-правами. Владелец настраивает роли по модулям (Просмотр / Управление),
 * а мы разворачиваем выбор в карту прав `OrganizationPermissionCheck`.
 *
 * DX: чтобы завести ролевой доступ для новой части приложения — добавьте сюда
 * модуль и его bundle прав. Реестр и есть точка конфигурации.
 *
 * По образцу `src/lib/features/registry.ts`.
 */

import type { OrganizationPermissionCheck, OrganizationStatementKeys } from './organization'

/** Уровень доступа к модулю. `manage` включает в себя `view`. */
export type ModuleLevel = 'none' | 'view' | 'manage'

export type PermissionModuleKey =
  | 'students'
  | 'groups'
  | 'lessons'
  | 'finances'
  | 'managerSalaries'
  | 'members'

type ModuleDef = {
  label: string
  description?: string
  /** Права уровня «Просмотр». */
  view: OrganizationPermissionCheck
  /** Дополнительные права уровня «Управление» (поверх `view`). */
  manage: OrganizationPermissionCheck
}

export const PERMISSION_MODULES: Record<PermissionModuleKey, ModuleDef> = {
  students: {
    label: 'Ученики',
    description: 'Ученики, их группы, посещаемость и кошельки',
    view: {
      student: ['read'],
      studentGroup: ['read'],
      studentLesson: ['read'],
      wallet: ['read'],
    },
    manage: {
      student: ['create', 'update', 'delete'],
      studentGroup: ['create', 'update', 'delete'],
      studentLesson: ['create', 'update', 'delete', 'selectWarned'],
      wallet: ['create', 'update', 'delete'],
    },
  },
  groups: {
    label: 'Группы',
    description: 'Группы, типы групп и назначение преподавателей',
    view: {
      group: ['read'],
      groupType: ['read'],
      teacherGroup: ['read'],
    },
    manage: {
      group: ['create', 'update', 'delete'],
      groupType: ['create', 'update', 'delete'],
      teacherGroup: ['create', 'update', 'delete'],
    },
  },
  lessons: {
    label: 'Уроки',
    description: 'Уроки, посещаемость и история',
    view: {
      lesson: ['readSelf'],
      teacherLesson: ['read'],
      lessonStudentHistory: ['read'],
    },
    manage: {
      lesson: ['create', 'readAll', 'update', 'delete'],
      teacherLesson: ['create', 'update', 'delete'],
      lessonStudentHistory: ['update'],
    },
  },
  finances: {
    label: 'Финансы',
    description: 'Оплаты, чеки, ставки и зарплаты',
    view: {
      payment: ['read'],
      paycheck: ['read'],
      rate: ['read'],
      salary: ['readSelf'],
    },
    manage: {
      payment: ['create', 'update', 'delete'],
      paycheck: ['create', 'update', 'delete'],
      rate: ['create', 'update', 'delete'],
      salary: ['readAll'],
    },
  },
  managerSalaries: {
    label: 'Зарплаты менеджеров',
    description: 'Фиксированные ставки менеджеров',
    view: {
      managerSalary: ['read'],
    },
    manage: {
      managerSalary: ['create', 'update', 'delete'],
    },
  },
  members: {
    label: 'Сотрудники',
    description: 'Управление участниками организации',
    view: {
      member: ['read'],
    },
    manage: {
      member: ['create', 'update', 'delete'],
    },
  },
}

export const PERMISSION_MODULE_KEYS = Object.keys(PERMISSION_MODULES) as PermissionModuleKey[]

/** Выбор уровней доступа по модулям (форма редактора роли). */
export type ModuleSelection = Partial<Record<PermissionModuleKey, ModuleLevel>>

/** Объединяет несколько карт прав в одну (union действий по ресурсам). */
export function mergePermissions(
  ...maps: (OrganizationPermissionCheck | undefined)[]
): OrganizationPermissionCheck {
  const result: Record<string, Set<string>> = {}
  for (const map of maps) {
    if (!map) continue
    for (const [key, actions] of Object.entries(map)) {
      const set = (result[key] ??= new Set<string>())
      for (const action of actions ?? []) set.add(action)
    }
  }
  return Object.fromEntries(
    Object.entries(result).map(([key, set]) => [key, [...set]]),
  ) as OrganizationPermissionCheck
}

/** Разворачивает выбор модулей в карту прав. */
export function modulesToPermission(selection: ModuleSelection): OrganizationPermissionCheck {
  const parts: OrganizationPermissionCheck[] = []
  for (const key of PERMISSION_MODULE_KEYS) {
    const level = selection[key] ?? 'none'
    if (level === 'none') continue
    const mod = PERMISSION_MODULES[key]
    parts.push(mod.view)
    if (level === 'manage') parts.push(mod.manage)
  }
  return mergePermissions(...parts)
}

/** Проверяет, что все действия из `subset` содержатся в `permission`. */
function permissionIncludes(
  permission: OrganizationPermissionCheck,
  subset: OrganizationPermissionCheck,
): boolean {
  for (const [key, actions] of Object.entries(subset)) {
    const granted = (permission[key as OrganizationStatementKeys] ?? []) as string[]
    for (const action of actions ?? []) {
      if (!granted.includes(action)) return false
    }
  }
  return true
}

/**
 * Обратное отображение: по карте прав определяет выбранный уровень каждого
 * модуля (для формы редактирования). Best-effort — берётся максимальный
 * полностью покрытый уровень.
 */
export function permissionToModules(permission: OrganizationPermissionCheck): ModuleSelection {
  const selection: ModuleSelection = {}
  for (const key of PERMISSION_MODULE_KEYS) {
    const mod = PERMISSION_MODULES[key]
    const manageFull = mergePermissions(mod.view, mod.manage)
    if (permissionIncludes(permission, manageFull)) {
      selection[key] = 'manage'
    } else if (permissionIncludes(permission, mod.view)) {
      selection[key] = 'view'
    } else {
      selection[key] = 'none'
    }
  }
  return selection
}
