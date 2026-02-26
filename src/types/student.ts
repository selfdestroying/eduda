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

export type StudentDTO1 = Prisma.StudentGetPayload<{
  include: {
    groups: {
      include: {
        group: {
          include: {
            location: true
            course: true
            students: true
            lessons: true
            teachers: {
              include: {
                teacher: true
              }
            }
          }
        }
      }
    }
    attendances: {
      include: {
        lesson: true
        asMakeupFor: { include: { missedAttendance: { include: { lesson: true } } } }
        missedMakeup: { include: { makeUpAttendance: { include: { lesson: true } } } }
      }
    }
  }
}>

export interface StudentDTO {
  id: number
  firstName: string
  lastName: string
  login: string
  password: string
  age: number
  birthDate: Date
  parentsName: string | null
  parentsPhone: string | null
  url: string | null
  createdAt: Date
  updatedAt: Date
  organizationId: number
  coins: number
  lessonsBalance: number
  totalLessons: number
  totalPayments: number
}
