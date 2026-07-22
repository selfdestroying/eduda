'use client'

import { useSessionQuery } from '@/src/features/users/me/queries'
import { DEFAULT_TZ } from '@/src/lib/timezone'

/**
 * Часовой пояс текущей организации на клиенте.
 * Читает снапшот сессии (тот же источник, что `useFeatureEnabled`),
 * fallback на `DEFAULT_TZ` до резолва запроса / при пустой колонке.
 */
export function useOrgTimezone(): string {
  const { data: session } = useSessionQuery()
  return session?.organization?.timezone ?? DEFAULT_TZ
}
