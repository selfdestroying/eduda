import { getGroupTypes } from '@/src/actions/group-types'
import { useQuery } from '@tanstack/react-query'
import { groupTypeKeys } from './keys'

export async function getGroupTypeList(organizationId: number) {
  return await getGroupTypes({
    where: { organizationId },
    include: {
      rate: true,
      _count: { select: { groups: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export type GroupTypeListData = Awaited<ReturnType<typeof getGroupTypeList>>

export const useGroupTypeListQuery = (organizationId: number) => {
  return useQuery({
    queryKey: groupTypeKeys.list(organizationId),
    queryFn: () => getGroupTypeList(organizationId),
    enabled: !!organizationId,
  })
}

export const useMappedGroupTypeListQuery = (organizationId: number) => {
  return useQuery({
    queryKey: groupTypeKeys.list(organizationId),
    queryFn: () => getGroupTypeList(organizationId),
    enabled: !!organizationId,
    select: (groupTypes) =>
      groupTypes.map((gt) => ({
        value: gt.id.toString(),
        label: gt.name,
      })),
  })
}
