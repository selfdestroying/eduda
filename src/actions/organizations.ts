'use server'

import { auth } from '../lib/auth/server'

export interface OrganizationCreateParams {
  ownerId: string
  name: string
  slug: string
  logo?: string
}

export const createOrganization = async (params: OrganizationCreateParams) => {
  await auth.api.createOrganization({
    body: {
      name: params.name,
      slug: params.slug,
      userId: params.ownerId,
    },
  })
}

export interface MemberAddParams {
  userId: string
  role: 'owner' | 'manager' | 'teacher' | ('owner' | 'manager' | 'teacher')[]
  organizationId: string
}

export const addMember = async (params: MemberAddParams) => {
  return await auth.api.addMember({
    body: params,
  })
}
