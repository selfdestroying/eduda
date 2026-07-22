import { Prisma } from '@/prisma/generated/client'

export type WalletWithGroups = Prisma.WalletGetPayload<{
  include: {
    studentGroups: {
      include: {
        group: { include: { course: true; location: true; schedules: true } }
      }
    }
  }
}>
