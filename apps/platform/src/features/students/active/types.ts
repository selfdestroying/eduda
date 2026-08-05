import { Prisma } from '@repo/db'

export type ActiveStudent = Prisma.StudentGroupGetPayload<{
  include: {
    group: {
      include: {
        location: true
        course: true
        schedules: true
        teachers: {
          include: {
            teacher: true
          }
        }
      }
    }
    student: {
      include: {
        payments: true
      }
    }
    wallet: true
  }
}>
