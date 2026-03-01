'use server'

import prisma from '@/src/lib/db/prisma'
import { revalidatePath } from 'next/cache'
import { Prisma } from '../../prisma/generated/client'

export const getCategories = async <T extends Prisma.CategoryFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.CategoryFindManyArgs>,
) => {
  return await prisma.category.findMany(payload)
}

export const createCategory = async (payload: Prisma.CategoryCreateArgs) => {
  await prisma.category.create(payload)
  revalidatePath('/dashboard/categories')
}

export const updateCategory = async ({ where, data }: Prisma.CategoryUpdateArgs) => {
  await prisma.category.update({ where, data })
  revalidatePath('/dashboard/categories')
}

export const deleteCategory = async (payload: Prisma.CategoryDeleteArgs) => {
  await prisma.category.delete(payload)
  revalidatePath('/dashboard/categories')
}
