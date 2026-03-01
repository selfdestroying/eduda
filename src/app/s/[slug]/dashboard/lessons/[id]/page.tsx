import { getStudents } from '@/src/actions/students'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AddAttendanceButton from './_components/add-attendance-button'
import AddTeacherToLessonButton from './_components/add-teacher-to-lesson-button'
import AttendanceTable from './_components/attendance-table'
import InfoSection from './_components/info-section'
import LessonTeachersTable from './_components/lesson-teachers-table'

export const metadata = { title: 'Карточка урока' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const id = (await params).id
  const lesson = await prisma.lesson.findFirst({
    where: { id: +id, organizationId: session.organizationId! },
    include: {
      teachers: {
        include: {
          teacher: true,
        },
      },
      group: {
        include: {
          _count: { select: { students: true } },
          students: { include: { student: true } },
          course: true,
          location: true,
          groupType: { include: { rate: true } },
        },
      },
      attendance: {
        where: {
          NOT: {
            AND: [
              { status: 'UNSPECIFIED' },
              { student: { groups: { some: { status: 'DISMISSED' } } } },
            ],
          },
        },
        include: {
          student: true,
          lesson: {
            include: {
              group: {
                include: {
                  course: true,
                  location: true,
                },
              },
            },
          },
          asMakeupFor: { include: { missedAttendance: { include: { lesson: true } } } },
          missedMakeup: { include: { makeUpAttendance: { include: { lesson: true } } } },
        },
        orderBy: {
          id: 'asc',
        },
      },
    },
  })
  const students = await getStudents({
    where: {
      id: { notIn: lesson?.attendance.map((a) => a.studentId) },
      organizationId: session.organizationId!,
    },
  })

  if (!lesson) {
    return <div>Ошибка при получении урока</div>
  }

  const { success: canCreateTeacherLesson } = await auth.api.hasPermission({
    headers: requestHeaders,
    body: {
      permissions: { teacherLesson: ['create'] },
    },
  })

  const { success: canCreateStudentLesson } = await auth.api.hasPermission({
    headers: requestHeaders,
    body: {
      permissions: { studentLesson: ['create'] },
    },
  })

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <InfoSection lesson={lesson} />
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">Преподаватели</CardTitle>
            {canCreateTeacherLesson && (
              <CardAction>
                <AddTeacherToLessonButton lesson={lesson} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <LessonTeachersTable data={lesson.teachers} />
          </CardContent>
        </Card>
      </div>
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Список учеников</CardTitle>
          {canCreateStudentLesson && (
            <CardAction>
              <AddAttendanceButton
                lessonId={lesson.id}
                students={students}
                isFull={lesson.attendance.length >= lesson.group.maxStudents}
              />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <AttendanceTable data={lesson.attendance} />
        </CardContent>
      </Card>
    </div>
  )
}
