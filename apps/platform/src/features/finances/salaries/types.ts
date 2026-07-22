import { Prisma } from '@repo/db/browser'
import { User } from '@repo/db'

export type LessonWithPrice = Prisma.LessonGetPayload<{
  include: {
    teachers: {
      include: {
        teacher: true
      }
    }
    group: {
      include: {
        course: true
        location: true
        groupType: true
        schedules: true
      }
    }
    _count: { select: { attendance: { where: { status: 'PRESENT' } } } }
  }
}> & { price: number; bonusPerStudent: number; presentCount: number }

export type TeacherSalaryData = {
  teacher: User
  lessons: LessonWithPrice[]
}

export interface SalaryFilters {
  startDate: string
  endDate: string
  courseIds?: number[]
  locationIds?: number[]
  teacherIds?: number[]
}
