import { Prisma } from '@/prisma/generated/client'

export type ProductWithCategory = Prisma.ProductGetPayload<{ include: { category: true } }>
