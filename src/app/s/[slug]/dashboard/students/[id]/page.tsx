import { getGroups } from '@/src/actions/groups'
import {
  getStudent,
  getStudentGroupHistory,
  getStudentLessonsBalanceHistory,
} from '@/src/actions/students'
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth'
import { getFullName, protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import CourseAttendanceStats from './_components/course-attendance-stats'
import EditStudentDialog from './_components/edit-student-dialog'
import GroupHistory from './_components/group-history'
import LessonsBalanceHistory from './_components/lessons-balance-history'
import PaymentSection from './_components/payment-section'
import RedistributeBalance from './_components/redistribute-balance'
import StudentCard from './_components/student-card'
import StudentGroupsSection from './_components/student-groups-section'

export const metadata = { title: 'Карточка ученика' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const { id } = await params
  const student = await getStudent({
    where: { id: Number(id), organizationId: session.organizationId! },
    include: {
      groups: {
        include: {
          group: {
            include: {
              lessons: {
                orderBy: { date: 'asc' },
              },
              course: true,
              location: true,
            },
          },
        },
      },
      attendances: {
        include: {
          lesson: {
            include: {
              group: {
                include: {
                  course: true,
                },
              },
            },
          },
          asMakeupFor: { include: { missedAttendance: { include: { lesson: true } } } },
          missedMakeup: { include: { makeUpAttendance: { include: { lesson: true } } } },
        },
      },
    },
  })

  if (!student) return <div>Ошибка при получении ученика</div>

  const [lessonsBalanceHistory, groupHistory] = await Promise.all([
    getStudentLessonsBalanceHistory(student.id, 50),
    getStudentGroupHistory(student.id, session.organizationId!),
  ])

  const groups = await getGroups({
    where: {
      students: { none: { studentId: student.id } },
      organizationId: session.organizationId!,
    },
    include: {
      students: true,
      course: true,
      location: true,
      schedules: true,
      teachers: {
        include: {
          teacher: true,
        },
      },
    },
    orderBy: [
      {
        dayOfWeek: 'asc',
      },
      {
        time: 'asc',
      },
    ],
  })

  const { success: canEdit } = await auth.api.hasPermission({
    headers: requestHeaders,
    body: {
      permission: { student: ['update'] },
    },
  })

  const { success: canEditLessonsHistory } = await auth.api.hasPermission({
    headers: requestHeaders,
    body: {
      permission: { lessonStudentHistory: ['update'] },
    },
  })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback>
                  {student.firstName?.[0]?.toUpperCase()}
                  {student.lastName?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {getFullName(student.firstName, student.lastName)}
            </div>
          </CardTitle>
          {canEdit && (
            <CardAction>
              <EditStudentDialog student={student} />
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <StudentCard student={student} />
          <PaymentSection student={student} />
          <RedistributeBalance student={student} />
          <StudentGroupsSection student={student} groups={groups} />
          <CourseAttendanceStats student={student} />

          <GroupHistory history={groupHistory} />
          {canEditLessonsHistory && <LessonsBalanceHistory history={lessonsBalanceHistory} />}
        </CardContent>
      </Card>
    </div>
  )
}
