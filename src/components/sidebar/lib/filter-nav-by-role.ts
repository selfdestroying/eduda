import type { OrganizationRole } from '@/src/lib/auth/server'
import type { NavGroup } from './types'

export function filterNavByRole(nav: NavGroup[], role: OrganizationRole): NavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.roles.includes(role) && group.items.length > 0)
}
