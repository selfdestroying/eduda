import { SYSTEM_ROLES } from '@/src/lib/permissions/organization'
import * as z from 'zod'

const ModuleLevelSchema = z.enum(['none', 'view', 'manage'])

/** Выбор уровней доступа по модулям (ключи проверяются в actions/registry). */
const ModuleSelectionSchema = z.record(z.string(), ModuleLevelSchema)

const RoleSlugSchema = z
  .string('Введите идентификатор роли')
  .min(2, 'Минимум 2 символа')
  .max(50, 'Максимум 50 символов')
  .regex(/^[a-z][a-z0-9_-]*$/, 'Только латиница в нижнем регистре, цифры, - и _')

const RoleLabelSchema = z
  .string('Введите название роли')
  .min(2, 'Минимум 2 символа')
  .max(50, 'Максимум 50 символов')

export const CreateRoleSchema = z.object({
  role: RoleSlugSchema.refine(
    (v) => !SYSTEM_ROLES.includes(v as (typeof SYSTEM_ROLES)[number]),
    'Это имя зарезервировано системной ролью',
  ),
  label: RoleLabelSchema,
  modules: ModuleSelectionSchema,
})

export const UpdateRoleSchema = z.object({
  /** Идентификатор роли (slug) — неизменяем после создания. */
  role: RoleSlugSchema,
  label: RoleLabelSchema,
  modules: ModuleSelectionSchema,
})

/** Редактирование названия и (для кастомных ролей) идентификатора. */
export const UpdateRoleInfoSchema = z.object({
  /** Текущий идентификатор роли. */
  role: RoleSlugSchema,
  label: RoleLabelSchema,
  /** Новый идентификатор (только для кастомных ролей). Отсутствует — не меняем. */
  newRole: RoleSlugSchema.optional(),
})

export const DeleteRoleSchema = z.object({
  role: RoleSlugSchema,
})

export type CreateRoleSchemaType = z.infer<typeof CreateRoleSchema>
export type UpdateRoleSchemaType = z.infer<typeof UpdateRoleSchema>
export type UpdateRoleInfoSchemaType = z.infer<typeof UpdateRoleInfoSchema>
export type DeleteRoleSchemaType = z.infer<typeof DeleteRoleSchema>
