import { Prisma } from '@repo/db'

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

/**
 * Поля, которые рисует таблица групп, — и ничего сверх них. `include: true` тянул
 * в браузер каждого ученика группы целиком: списку нужно только их количество.
 */
export const GROUP_LIST_SELECT = {
  id: true,
  name: true,
  url: true,
  // Не колонка сама по себе: по статусу рядом с названием встаёт бейдж.
  status: true,
  course: { select: { name: true } },
  location: { select: { name: true } },
  groupType: { select: { name: true } },
  schedules: { select: { dayOfWeek: true, time: true } },
  teachers: { select: { teacher: { select: { id: true, name: true } } } },
  _count: { select: { students: true } },
} satisfies Prisma.GroupSelect

/** Строка таблицы. */
export type GroupListItem = Prisma.GroupGetPayload<{ select: typeof GROUP_LIST_SELECT }>

/**
 * Срез плюс общее число строк по тому же `where`. `total` нужен пагинации: сама
 * она видит только текущую страницу и посчитать количество страниц не может.
 */
export type GroupListResult = {
  rows: GroupListItem[]
  total: number
}
