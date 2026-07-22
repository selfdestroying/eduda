import type { OrganizationRole } from '@/src/lib/auth/server'
import type { FeatureKey } from '@/src/lib/features/registry'
import type { OrganizationPermissionCheck } from '@/src/lib/permissions/organization'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  title: string
  url: string
  roles: OrganizationRole[]
  /** Опциональный permission-гейт (в дополнение к `roles`, для динамических ролей). */
  permission?: OrganizationPermissionCheck
  featureKey?: FeatureKey
}

/**
 * Second-level grouping inside a top-level NavGroup.
 * Acts like a mini-group with its own optional landing url and sub-items.
 */
export type NavSubGroup = {
  kind: 'subgroup'
  title: string
  /** Optional landing page for the subgroup. */
  url?: string
  roles: OrganizationRole[]
  permission?: OrganizationPermissionCheck
  featureKey?: FeatureKey
  items: NavItem[]
}

/** Direct child of a top-level group: either a leaf link or a nested subgroup. */
export type NavGroupChild = NavItem | NavSubGroup

export type NavGroup = {
  title: string
  icon: LucideIcon
  roles: OrganizationRole[]
  permission?: OrganizationPermissionCheck
  /** Optional landing page for the group; clicking the group title navigates here. */
  url?: string
  items: NavGroupChild[]
  featureKey?: FeatureKey
}

/** Standalone link without sub-items (e.g. dashboard, smart feed). */
export type NavLeaf = {
  title: string
  url: string
  icon: LucideIcon
  roles: OrganizationRole[]
  permission?: OrganizationPermissionCheck
  featureKey?: FeatureKey
}

/** Type guard to distinguish nested subgroups from plain items inside a group. */
export function isSubGroup(child: NavGroupChild): child is NavSubGroup {
  return (child as NavSubGroup).kind === 'subgroup'
}
