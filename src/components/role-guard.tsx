'use client'

import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import type { OrganizationPermissionCheck } from '@/src/lib/permissions/organization'
import type { ReactNode } from 'react'

interface RoleGuardProps {
  /** Требуемые права, например `{ payment: ['create'] }`. */
  permission: OrganizationPermissionCheck
  /** Что показать, если прав нет. По умолчанию — ничего. */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Показывает `children` только если у пользователя есть запрошенные права.
 * Проверка синхронная (снапшот сессии), поддерживает динамические роли.
 *
 * @example
 * <RoleGuard permission={{ payment: ['create'] }}>
 *   <CreatePaymentButton />
 * </RoleGuard>
 */
export function RoleGuard({ permission, fallback = null, children }: RoleGuardProps) {
  const allowed = useHasPermission(permission)
  return <>{allowed ? children : fallback}</>
}
