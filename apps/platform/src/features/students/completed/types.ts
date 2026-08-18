import { Prisma } from '@repo/db'

export type ComStudent = Prisma.StudentGroupGetPayload<{
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
        packages: true
      }
    }
    wallet: true
  }
}>
