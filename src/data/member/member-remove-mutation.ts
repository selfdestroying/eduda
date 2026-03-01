import { authClient } from '@/src/lib/auth/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { memberKeys } from './keys'

export interface MemberRemoveParams {
  memberIdOrEmail: string
  organizationId: string
}

export async function removeMember(params: MemberRemoveParams) {
  const { data, error } = await authClient.organization.removeMember(params)
  if (error) throw new Error(error.message)

  return data
}

export const useMemberRemoveMutation = (organizationId: number) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) =>
      removeMember({
        memberIdOrEmail: memberId.toString(),
        organizationId: organizationId.toString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: memberKeys.list(organizationId),
      })
      toast.success('Member removed successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove member')
    },
  })
}
