'use server'

import prisma from '@/src/lib/db/prisma'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import { revalidatePath } from 'next/cache'
import path from 'path'
import { Prisma } from '../../prisma/generated/client'

export type ProductWithCategory = Prisma.ProductGetPayload<{ include: { category: true } }>

export const getProducts = async <T extends Prisma.ProductFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.ProductFindManyArgs>,
) => {
  return await prisma.product.findMany<T>(payload)
}

export async function createProduct(payload: Prisma.ProductCreateArgs, image: File) {
  if (image) {
    const buffer = Buffer.from(await image.arrayBuffer())
    const ext = path.extname(image.name)
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
    const filePath = path.join('/var/www/storage/images', fileName)
    const fileUrl = `http://images.alg.tw1.ru/images/${fileName}`

    await fs.writeFile(filePath, buffer)
    payload.data.image = fileUrl
  }
  await prisma.product.create(payload)

  revalidatePath('/dashboard/products')
}

export async function updateProduct(payload: Prisma.ProductUpdateArgs, image?: File) {
  if (image) {
    const buffer = Buffer.from(await image.arrayBuffer())
    const ext = path.extname(image.name)
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
    const filePath = path.join('/var/www/storage/images', fileName)
    const fileUrl = `http://images.alg.tw1.ru/images/${fileName}`

    await fs.writeFile(filePath, buffer)
    payload.data.image = fileUrl
  }

  await prisma.product.update(payload)
  revalidatePath('/dashboard/products')
}

export async function deleteProduct(payload: Prisma.ProductDeleteArgs) {
  await prisma.product.delete(payload)
  revalidatePath('/dashboard/products')
}
