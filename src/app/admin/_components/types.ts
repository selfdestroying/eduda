import type { Prisma } from '@/prisma/generated/client'

export type AdminUser = {
  id: number
  name: string
  email: string
  role: string | null
  banned: boolean | null
  createdAt: Date
  emailVerified: boolean
}

export type AdminOrganization = Prisma.OrganizationGetPayload<{
  include: {
    members: {
      include: { user: true }
    }
  }
}>

export type AdminDashboardData = {
  users: AdminUser[]
  organizations: AdminOrganization[]
}
