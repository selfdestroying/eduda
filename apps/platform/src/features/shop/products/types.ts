import { Prisma } from '@repo/db'

export type ProductWithCategory = Prisma.ProductGetPayload<{ include: { category: true } }>
