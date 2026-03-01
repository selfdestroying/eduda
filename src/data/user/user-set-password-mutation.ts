import { authClient } from '@/src/lib/auth/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userKeys } from './keys'

export interface OrganizationActiveParams {
  userId: number
  newPassword: string
}

export async function setUserPassword(params: OrganizationActiveParams) {
  const { data, error } = await authClient.admin.setUserPassword(params)
  if (error) throw new Error(error.message)

  return data
}

export const useUserSetPasswordMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setUserPassword,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: userKeys.all(),
      })
    },
  })
}
