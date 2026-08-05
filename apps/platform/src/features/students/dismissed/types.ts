import { Prisma } from '@repo/db'

export type DismissedWithStudentAndGroup = Prisma.StudentGroupGetPayload<{
  include: {
    student: true
    group: {
      include: {
        course: true
        location: true
        schedules: true
        teachers: { include: { teacher: { include: { members: true } } } }
      }
    }
  }
}>
