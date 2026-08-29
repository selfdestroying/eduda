import { auth } from '@/src/lib/auth/server'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'

/**
 * Показывает содержимое только владельцу школы.
 *
 * Серверный, в отличие от `FeatureGate`: роль известна ещё до рендера, и
 * закрытый блок не уезжает в браузер, чтобы там спрятаться. Это гейт видимости,
 * а не доступа — данные закрывает экшен, который их отдаёт.
 */
export default async function OwnerOnly({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.memberRole === 'owner' ? children : null
}
