export const rateKeys = {
  all: ['rates'] as const,
  lists: () => [...rateKeys.all, 'list'] as const,
  list: (organizationId: number) => [...rateKeys.lists(), { organizationId }] as const,
}
