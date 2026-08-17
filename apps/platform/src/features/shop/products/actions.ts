'use server'

import { prisma } from '@repo/db'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { ArchiveProductSchema, CreateProductSchema, UpdateProductSchema } from './schemas'
import { featureAction } from '@/src/lib/safe-action'

const IMAGE_URL = process.env.IMAGE_URL ?? ''
const IMAGE_PATH = process.env.IMAGE_PATH ?? ''

export const getProducts = featureAction('shop')
  .metadata({ actionName: 'getProducts' })
  .action(async ({ ctx }) => {
    return await prisma.shopItem.findMany({
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
    await prisma.shopItem.create({
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
      const existing = await prisma.shopItem.findUnique({
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

    await prisma.shopItem.update({
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

/**
 * Архивация вместо удаления: товар пропадает из каталога ученика, но остаётся в
 * его истории заказов — коины за него уже списаны, и стирать это нельзя.
 * Картинку тоже не трогаем: она нужна той самой истории.
 */
export const archiveProduct = featureAction('shop')
  .metadata({ actionName: 'archiveProduct' })
  .inputSchema(ArchiveProductSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.shopItem.update({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      data: { archivedAt: new Date() },
    })
  })

export const restoreProduct = featureAction('shop')
  .metadata({ actionName: 'restoreProduct' })
  .inputSchema(ArchiveProductSchema)
  .action(async ({ ctx, parsedInput }) => {
    await prisma.shopItem.update({
      where: { id: parsedInput.id, organizationId: ctx.session.organizationId! },
      data: { archivedAt: null },
    })
  })
