import { Prisma } from '@repo/db'

export type RentWithLocation = Prisma.RentGetPayload<{ include: { location: true } }>
