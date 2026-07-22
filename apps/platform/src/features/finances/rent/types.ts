import { Prisma } from '@/prisma/generated/client'

export type RentWithLocation = Prisma.RentGetPayload<{ include: { location: true } }>
