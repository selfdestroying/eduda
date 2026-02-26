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
  const studentId = Number(id)

  const [
    student,
    groups,
    lessonsBalanceHistory,
    groupHistory,
    { success: canEdit },
    { success: canEditLessonsHistory },
    { success: canCreateStudentGroup },
  ] = await Promise.all([
    getStudent({
      where: { id: studentId, organizationId: session.organizationId! },
      include: {
        groups: {
          include: {
            group: {
              include: {
                lessons: {
                  include: {
                    attendance: {
                      where: { studentId },
                      include: {
                        missedMakeup: {
                          include: { makeUpAttendance: { include: { lesson: true } } },
                        },
                      },
                    },
                  },
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
                group: { include: { course: true } },
              },
            },
            asMakeupFor: true,
            missedMakeup: { include: { makeUpAttendance: true } },
          },
        },
      },
    }),
    getGroups({
      where: {
        students: { none: { studentId } },
        organizationId: session.organizationId!,
      },
      include: {
        students: true,
        course: true,
        location: true,
        schedules: true,
        groupType: { include: { rate: true } },
        teachers: {
          include: {
            teacher: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { time: 'asc' }],
    }),
    getStudentLessonsBalanceHistory(studentId, 50),
    getStudentGroupHistory(studentId, session.organizationId!),
    auth.api.hasPermission({
      headers: requestHeaders,
      body: { permission: { student: ['update'] } },
    }),
    auth.api.hasPermission({
      headers: requestHeaders,
      body: { permission: { lessonStudentHistory: ['update'] } },
    }),
    auth.api.hasPermission({
      headers: requestHeaders,
      body: { permission: { studentGroup: ['create'] } },
    }),
  ])

  if (!student) return <div>Ошибка при получении ученика</div>

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
          <StudentGroupsSection
            student={student}
            groups={groups}
            canCreateStudentGroup={canCreateStudentGroup}
          />
          <CourseAttendanceStats student={student} />

          <GroupHistory history={groupHistory} />
          {canEditLessonsHistory && <LessonsBalanceHistory history={lessonsBalanceHistory} />}
        </CardContent>
      </Card>
    </div>
  )
}
