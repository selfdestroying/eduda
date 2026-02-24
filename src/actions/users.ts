'use server'
import prisma from '@/src/lib/prisma'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { Prisma } from '../../prisma/generated/client'
import { auth } from '../lib/auth'

export interface UserCreateParams {
  email: string
  password: string
  name: string
  role: 'user' | 'admin' | 'owner' | ('user' | 'admin' | 'owner')[]
  data: {
    firstName: string
    lastName: string
  }
}

export const getUsers = async <T extends Prisma.UserFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>
) => {
  return await prisma.user.findMany<T>(payload)
}

export const getUser = async <T extends Prisma.UserFindFirstArgs>(
  payload: Prisma.SelectSubset<T, Prisma.UserFindFirstArgs>
) => {
  return await prisma.user.findFirst(payload)
}

export const createUser = async (params: UserCreateParams) => {
  return await auth.api.createUser({ body: params, headers: await headers() })
}

export const updateUser = async (payload: Prisma.UserUpdateArgs) => {
  await prisma.user.update(payload)
  revalidatePath(`dashboard/users/${payload.where.id}`)
}
