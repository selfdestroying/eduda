'use server'

import prisma from '@/src/lib/prisma'

import { revalidatePath } from 'next/cache'
import { Prisma } from '../../prisma/generated/client'

export type LessonWithCountUnspecified = Prisma.LessonGetPayload<{
  include: { _count: { select: { attendance: { where: { status: 'UNSPECIFIED' } } } } }
}>
export type LessonWithGroupAndAttendance = Prisma.LessonGetPayload<{
  include: {
    teachers: {
      include: {
        teacher: {
          omit: {
            password: true
            createdAt: true
          }
        }
      }
    }
    group: { include: { _count: { select: { students: true } } } }
    attendance: {
      include: {
        student: true
        asMakeupFor: { include: { missedAttendance: { include: { lesson: true } } } }
        missedMakeup: { include: { makeUpAttendance: { include: { lesson: true } } } }
      }
    }
  }
}>

export type LessonWithAttendanceAndGroup = Prisma.LessonGetPayload<{
  include: {
    attendance: { include: { student: true } }
    group: {
      include: {
        teachers: {
          include: {
            teacher: {
              omit: {
                password: true
                createdAt: true
              }
            }
          }
        }
      }
    }
  }
}>

export const getLessons = async <T extends Prisma.LessonFindManyArgs>(
  payload?: Prisma.SelectSubset<T, Prisma.LessonFindManyArgs>
) => {
  console.log('getLessons payload', payload)
  return prisma.lesson.findMany(payload)
}

export const getLesson = async <T extends Prisma.LessonFindFirstArgs>(
  payload: Prisma.SelectSubset<T, Prisma.LessonFindFirstArgs>
) => {
  return await prisma.lesson.findFirst(payload)
}

export const updateLesson = async (payload: Prisma.LessonUpdateArgs) => {
  await prisma.lesson.update(payload)
  revalidatePath(`/dashboard/lessons/${payload.where.id}`)
}

export const createLesson = async (payload: Prisma.LessonCreateArgs) => {
  await prisma.lesson.create(payload)

  revalidatePath(`dashboard/groups/${payload.data.groupId}`)
}

// Teacher-Lesson Relations

export async function createTeacherLesson(payload: Prisma.TeacherLessonCreateArgs) {
  await prisma.teacherLesson.create(payload)
  revalidatePath(`/dashboard/lessons/${payload.data.lessonId}`)
}

export async function deleteTeacherLesson(payload: Prisma.TeacherLessonDeleteArgs) {
  await prisma.teacherLesson.delete(payload)
  revalidatePath(`/dashboard/lessons/${payload.where.lessonId}`)
}

export async function updateTeacherLesson(payload: Prisma.TeacherLessonUpdateArgs) {
  await prisma.teacherLesson.update(payload)
  revalidatePath(`/dashboard/lessons/${payload.where.lessonId}`)
}
