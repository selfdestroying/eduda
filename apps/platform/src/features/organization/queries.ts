import { authClient } from '@/src/lib/auth/client'
import { OrganizationPermissionCheck } from '@/src/lib/permissions/organization'
import { useQuery } from '@tanstack/react-query'

export const organizationKeys = {
  all: () => ['organization'] as const,
  list: () => [...organizationKeys.all(), 'list'] as const,
  detail: () => [...organizationKeys.all(), 'detail'] as const,
  invitationDetail: (id: string) => [...organizationKeys.all(), 'invitation', id] as const,
  permission: (permission?: OrganizationPermissionCheck) =>
    [...organizationKeys.all(), 'permission', ...(permission ? [permission] : [])] as const,
}

export async function getOrganizationPermission(permission: OrganizationPermissionCheck) {
  const { data, error } = await authClient.organization.hasPermission({
    // better-auth ждёт изменяемые массивы — readonly существует только в типах
    permissions: permission as Parameters<
      typeof authClient.organization.hasPermission
    >[0]['permissions'],
  })
  if (error) throw new Error(error.message || 'Не удалось проверить права доступа')

  return data
}
export type OrganizationPermissionData = Awaited<ReturnType<typeof getOrganizationPermission>>

export const useOrganizationPermissionQuery = (permission: OrganizationPermissionCheck) => {
  return useQuery({
    queryKey: organizationKeys.permission(permission),
    queryFn: () => getOrganizationPermission(permission),
    enabled: !!permission,
  })
}
