import { authClient } from '@/src/lib/auth/client'
import { OrganizationPermissionCheck } from '@/src/lib/permissions/organization'
import { useQuery } from '@tanstack/react-query'
import { organizationKeys } from './keys'

export async function getOrganizationPermission(permission: OrganizationPermissionCheck) {
  const { data, error } = await authClient.organization.hasPermission({
    permissions: permission,
  })
  if (error) throw new Error(error.message)

  return data
}
export type OrganizationPermissionData = Awaited<ReturnType<typeof getOrganizationPermission>>

export const useOrganizationPermissionQuery = (permission: OrganizationPermissionCheck) => {
  return useQuery({
    queryKey: organizationKeys.permission(permission as Record<string, string[]>),
    queryFn: () => getOrganizationPermission(permission),
    enabled: !!permission,
  })
}
