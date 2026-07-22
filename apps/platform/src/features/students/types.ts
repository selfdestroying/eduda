import { Prisma } from '@/prisma/generated/client'

/** Students list - includes groups, wallets, parents */
export type StudentWithGroups = Prisma.StudentGetPayload<{
  include: { groups: true; wallets: true; parents: { include: { parent: true } } }
}>

/** Student detail page - full payload with attendance, wallets, parents */
export type StudentDetail = Prisma.StudentGetPayload<{
  include: {
    account: true
    parents: { include: { parent: true } }
    groups: {
      include: {
        group: {
          include: {
            lessons: {
              include: {
                attendance: {
                  include: {
                    makeupAttendance: { include: { lesson: true } }
                  }
                }
              }
            }
            course: true
            location: true
            schedules: true
          }
        }
      }
    }
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
