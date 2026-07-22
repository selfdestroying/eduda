import { Prisma } from '@repo/db'

export type WalletWithGroups = Prisma.WalletGetPayload<{
  include: {
    studentGroups: {
      include: {
        group: { include: { course: true; location: true; schedules: true } }
      }
    }
  }
}>
