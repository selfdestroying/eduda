export interface RevenueStats {
  totalLessons: number
  doneLessons: number
  presentCount: number
  totalStudentVisits: number
  attendanceRate: number
  totalRevenue: number
  chargedVisits: number
  avgPerVisit: number
  avgPerLesson: number
}

export interface AttendanceWithCost {
  status: string
  isWarned: boolean | null
  isTrial: boolean
  visitCost: number
  costReason: string
  student: {
    id: number
    firstName: string
    lastName: string
  }
  wallet: {
    id: number
    name: string | null
    lessonsBalance: number
    totalLessons: number
    totalPayments: number
  } | null
  makeupAttendance: {
    status: string
    lesson: {
      date: string
      group: { course: { name: string } }
    }
  } | null
}

export interface LessonWithCost {
  id: number
  date: string
  time: string
  status: string
  dayOfWeek: string
  group: {
    id: number
    course: { name: string }
    location: { name: string } | null
    groupType: { name: string } | null
    schedules: { dayOfWeek: number; time: string }[]
    teachers: { teacher: { name: string } }[]
  }
  attendance: AttendanceWithCost[]
}

export interface DayGroup {
  date: string
  dayOfWeek: string
  dayRevenue: number
  lessons: LessonWithCost[]
}

export interface RevenueData {
  stats: RevenueStats
  days: DayGroup[]
}
