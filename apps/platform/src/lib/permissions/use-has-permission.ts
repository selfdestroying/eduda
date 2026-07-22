'use client'

import { useSessionQuery } from '@/src/features/users/me/queries'
import { useMemo } from 'react'
import { checkPermission, type OrganizationPermissionCheck } from './organization'

/**
 * Синхронная проверка прав на клиенте по снапшоту `session.permissions`
 * (резолвится в `customSession`). Работает с динамическими ролями из БД
 * без сетевых round-trip'ов.
 *
 * @example
 * const canCreatePayment = useHasPermission({ payment: ['create'] })
 */
export function useHasPermission(required: OrganizationPermissionCheck): boolean {
  const { data: session } = useSessionQuery()
  const permissions = session?.permissions as OrganizationPermissionCheck | undefined

  return useMemo(() => checkPermission(permissions, required), [permissions, required])
}

/** Вся карта прав текущего пользователя (снапшот сессии). */
export function usePermissions(): OrganizationPermissionCheck {
  const { data: session } = useSessionQuery()
  return (session?.permissions as OrganizationPermissionCheck | undefined) ?? {}
}
