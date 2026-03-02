export const organizationKeys = {
  all: () => ['organization'] as const,
  list: () => [...organizationKeys.all(), 'list'] as const,
  detail: () => [...organizationKeys.all(), 'detail'] as const,
  invitationDetail: (id: string) => [...organizationKeys.all(), 'invitation', id] as const,
  permission: (permission?: Record<string, string[]>) =>
    [...organizationKeys.all(), 'permission', ...(permission ? [permission] : [])] as const,
}
