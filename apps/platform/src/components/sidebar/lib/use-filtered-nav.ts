'use client'

import { useSessionQuery } from '@/src/features/users/me/queries'
import type { OrganizationRole } from '@/src/lib/auth/server'
import type { OrganizationPermissionCheck } from '@/src/lib/permissions/organization'
import { useMemo } from 'react'
import { filterNav } from './filter-nav'
import { navEntries, type NavEntry } from './nav-config'

/**
 * Reads the current session and returns the navigation entries
 * filtered by the user's organization role and disabled features.
 *
 * Encapsulates the logic that was previously duplicated in
 * `nav-platform.tsx` and `nav-shop.tsx`.
 */
export function useFilteredNav(): {
  entries: NavEntry[]
  role: OrganizationRole | undefined
  isLoading: boolean
} {
  const { data: session, isLoading } = useSessionQuery()
  const role = (session?.memberRole ?? undefined) as OrganizationRole | undefined
  const rawDisabled = session?.disabledFeatures as string[] | undefined
  const permissions = session?.permissions as OrganizationPermissionCheck | undefined

  const entries = useMemo(() => {
    if (!role) return []
    return filterNav(navEntries, role, rawDisabled ?? [], permissions ?? {})
  }, [role, rawDisabled, permissions])

  return { entries, role, isLoading }
}
