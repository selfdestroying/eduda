'use server'

import prisma from '@/src/lib/db/prisma'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { CreateProductSchema, DeleteProductSchema, UpdateProductSchema } from './schemas'
import { featureAction } from '@/src/lib/safe-action'

const IMAGE_URL = process.env.IMAGE_URL ?? ''
const IMAGE_PATH = process.env.IMAGE_PATH ?? ''

export const getProducts = featureAction('shop')
  .metadata({ actionName: 'getProducts' })
  .action(async ({ ctx }) => {
    return await prisma.product.findMany({
      where: {
        organizationId: ctx.session.organizationId!,
      },
      include: { category: true },
      orderBy: { id: 'asc' },
    })
  })

async function deleteImageFile(imageUrl: string) {
  try {
    const url = new URL(imageUrl)
    const fileName = path.basename(url.pathname)
    await fs.unlink(path.join(IMAGE_PATH, fileName))
  } catch {
    // Ignore - file may not exist
  }
}

export const createProduct = featureAction('shop')
  .metadata({ actionName: 'createProduct' })
  .inputSchema(CreateProductSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { image, ...data } = parsedInput
    const buffer = Buffer.from(await image.arrayBuffer())
    const ext = path.extname(image.name)
    const fileName = `${randomUUID()}${ext}`
    const filePath = path.join(IMAGE_PATH, fileName)
    const fileUrl = new URL(fileName, IMAGE_URL)

    await fs.writeFile(filePath, buffer)
    await prisma.product.create({
      data: {
        ...data,
        imageUrl: fileUrl.href,
        organizationId: ctx.session.organizationId!,
      },
    })
  })

export const updateProduct = featureAction('shop')
  .metadata({ actionName: 'updateProduct' })
  .inputSchema(UpdateProductSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id, image, ...data } = parsedInput
    let imageUrl: string | undefined

    if (image) {
      const existing = await prisma.product.findUnique({
        where: { id, organizationId: ctx.session.organizationId! },
        select: { imageUrl: true },
      })

      const buffer = Buffer.from(await image.arrayBuffer())
      const ext = path.extname(image.name)
      const fileName = `${randomUUID()}${ext}`
      const filePath = path.join(IMAGE_PATH, fileName)
      const fileUrl = new URL(fileName, IMAGE_URL)
      imageUrl = fileUrl.href
      await fs.writeFile(filePath, buffer)

      if (existing?.imageUrl) {
        await deleteImageFile(existing.imageUrl)
      }
    }

    await prisma.product.update({
      where: {
        organizationId: ctx.session.organizationId!,
        id,
      },
      data: {
        ...data,
        imageUrl,
      },
    })
  })

export const deleteProduct = featureAction('shop')
  .metadata({ actionName: 'deleteProduct' })
  .inputSchema(DeleteProductSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { id } = parsedInput

    const product = await prisma.product.findUnique({
      where: { id, organizationId: ctx.session.organizationId! },
      select: { imageUrl: true },
    })

    await prisma.product.delete({ where: { id, organizationId: ctx.session.organizationId! } })

    if (product?.imageUrl) {
      await deleteImageFile(product.imageUrl)
    }
  })
