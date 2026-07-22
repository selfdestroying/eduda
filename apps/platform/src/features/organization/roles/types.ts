import type { OrganizationPermissionCheck } from '@/src/lib/permissions/organization'

/** Роль организации для UI управления доступами. */
export interface RoleDTO {
  /** Идентификатор роли (slug). Для системных ролей = owner/manager/teacher. */
  role: string
  /** Отображаемое имя. */
  label: string
  /** Резолвнутая карта прав. */
  permission: OrganizationPermissionCheck
  /** Системная роль (owner/manager/teacher). */
  isSystem: boolean
  /** Нельзя редактировать/удалять (owner). */
  immutable: boolean
  /** Есть ли уже строка в БД (иначе — статический дефолт, ещё не сохранён). */
  persisted: boolean
  /** Сколько участников имеют эту роль. */
  memberCount: number
}

/** Роль для назначения участнику (лёгкий список). */
export interface AssignableRole {
  role: string
  label: string
}
