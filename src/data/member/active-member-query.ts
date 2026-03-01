import { authClient } from '@/src/lib/auth/client'
import { useQuery } from '@tanstack/react-query'
import { memberKeys } from './keys'

export async function getActiveMember() {
  const { data, error } = await authClient.organization.getActiveMember()
  if (error) throw new Error(error.message)
  return data
}

export type ActiveMemberData = Awaited<ReturnType<typeof getActiveMember>>

export const useActiveMemberQuery = () => {
  return useQuery({
    queryKey: memberKeys.activeMember(),
    queryFn: getActiveMember,
  })
}
