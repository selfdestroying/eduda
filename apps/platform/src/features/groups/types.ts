import { Prisma } from '@/prisma/generated/client'

/** Groups list - includes relations needed for the table */
export type GroupWithRelations = Prisma.GroupGetPayload<{
  include: {
    location: true
    course: true
    students: { include: { student: true } }
    schedules: true
    groupType: { include: { rate: true } }
    teachers: { include: { teacher: true } }
  }
}>

/** Group detail page - basic payload */
export type GroupDetail = Prisma.GroupGetPayload<{
  include: {
    location: true
    course: true
    students: true
    schedules: true
    groupType: { include: { rate: true } }
    teachers: { include: { teacher: true } }
  }
}>

/** Group detail page - full payload with lessons, attendance, teachers with rates */
export type GroupDetailFull = Prisma.GroupGetPayload<{
  include: {
    lessons: {
      include: {
        attendance: {
          include: {
            student: true
            makeupForAttendance: { include: { lesson: true } }
            makeupAttendance: { include: { lesson: true } }
          }
        }
      }
    }
    location: true
    course: true
    schedules: true
    groupType: { include: { rate: true } }
    teachers: { include: { teacher: true; rate: true } }
    students: { include: { student: true } }
  }
}>

/** Teacher-group with rate */
export type TeacherGroupWithRate = Prisma.TeacherGroupGetPayload<{
  include: { teacher: true; rate: true }
}>

/** Student-group with student */
export type StudentGroupWithStudent = Prisma.StudentGroupGetPayload<{
  include: { student: true }
}>

/** Lesson with attendance for the attendance table */
export type LessonWithAttendance = Prisma.LessonGetPayload<{
  include: {
    attendance: {
      include: {
        student: true
        makeupForAttendance: { include: { lesson: true } }
        makeupAttendance: { include: { lesson: true } }
      }
    }
  }
}>

/** Attendance with makeup relations */
export type AttendanceWithRelations = Prisma.AttendanceGetPayload<{
  include: {
    makeupForAttendance: { include: { lesson: true } }
    makeupAttendance: { include: { lesson: true } }
  }
}>
