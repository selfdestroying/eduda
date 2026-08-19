import { Prisma } from '@repo/db'

export type ProductWithCategory = Prisma.ShopItemGetPayload<{ include: { category: true } }>
