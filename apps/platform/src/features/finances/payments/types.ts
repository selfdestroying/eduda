import { Prisma } from '@repo/db'

export type PaymentWithStudentAndGroup = Prisma.PaymentGetPayload<{
  include: {
    student: true
    group: { include: { course: true; location: true } }
    paymentMethod: true
  }
}>

export type StudentWithWalletsForPayment = Prisma.StudentGetPayload<{
  include: {
    wallets: {
      include: {
        studentGroups: {
          include: {
            group: { include: { course: true; location: true; schedules: true } }
          }
        }
      }
    }
  }
}>
