'use server'

import prisma from '@/src/lib/db/prisma'
import { Prisma } from '../../prisma/generated/client'

export const getCourses = async <T extends Prisma.CourseFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.CourseFindManyArgs>,
) => {
  return await prisma.course.findMany(payload)
}
