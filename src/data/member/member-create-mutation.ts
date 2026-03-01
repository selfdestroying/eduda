import { addMember } from '@/src/actions/organizations'
import { UserCreateParams } from '@/src/actions/users'
import { authClient } from '@/src/lib/auth/client'
import { useMutation } from '@tanstack/react-query'
import { userKeys } from '../user/keys'

const createMember = async ({
  userParams,
  memberRole,
  organizationId,
}: {
  userParams: UserCreateParams
  memberRole: 'owner' | 'manager' | 'teacher' | ('owner' | 'manager' | 'teacher')[]
  organizationId: string
}) => {
  const { data: newUser, error } = await authClient.admin.createUser({
    email: userParams.email,
    password: userParams.password,
    name: userParams.name,
    role: userParams.role,
    data: userParams.data,
  })
  if (error) throw new Error(error.message)
  const data = await addMember({
    userId: newUser.user.id,
    organizationId,
    role: memberRole,
  })

  return data
}

export const useMemberCreateMutation = () => {
  return useMutation({
    mutationFn: createMember,
    mutationKey: userKeys.all(),
  })
}
