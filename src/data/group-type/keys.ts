export const groupTypeKeys = {
  all: ['groupTypes'] as const,
  lists: () => [...groupTypeKeys.all, 'list'] as const,
  list: (organizationId: number) => [...groupTypeKeys.lists(), { organizationId }] as const,
}
