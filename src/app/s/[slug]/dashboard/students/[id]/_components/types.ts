import { Prisma } from '@/prisma/generated/client'

export type StudentWithGroupsAndAttendance = Prisma.StudentGetPayload<{
  include: {
    groups: {
      include: {
        group: {
          include: {
            lessons: {
              include: {
                attendance: {
                  include: {
                    missedMakeup: {
                      include: { makeUpAttendance: { include: { lesson: true } } }
                    }
                  }
                }
              }
            }
            course: true
            location: true
          }
        }
      }
    }
    attendances: {
      include: {
        lesson: { include: { group: { include: { course: true } } } }
        asMakeupFor: true
        missedMakeup: { include: { makeUpAttendance: true } }
      }
    }
  }
}>
