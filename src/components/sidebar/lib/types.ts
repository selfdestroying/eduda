import type { OrganizationRole } from '@/src/lib/auth/server'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  title: string
  url: string
  roles: OrganizationRole[]
}

export type NavGroup = {
  title: string
  icon: LucideIcon
  roles: OrganizationRole[]
  items: NavItem[]
}
