import { Prisma } from '@/prisma/generated/browser'
import { User } from '@/prisma/generated/client'

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
