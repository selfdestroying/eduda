import { Prisma } from '@/prisma/generated/client'

export type MemberWithUser = Prisma.MemberGetPayload<{ include: { user: true } }>
