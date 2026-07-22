import { Prisma } from '@repo/db'

export type MemberWithUser = Prisma.MemberGetPayload<{ include: { user: true } }>
