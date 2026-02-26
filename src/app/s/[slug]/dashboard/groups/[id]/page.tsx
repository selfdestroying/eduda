import { getGroup } from '@/src/actions/groups'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AddLessonButton from './_components/add-lesson-button'
import AddStudentToGroupButton from './_components/add-student-to-group-button'
import AddTeacherToGroupButton from './_components/add-teacher-to-group-button'
import { GroupAttendanceTable } from './_components/group-attendance-table'
import GroupStudentsTable from './_components/group-students-table'
import GroupTeachersTable from './_components/group-teachers-table'
import InfoSection from './_components/info-section'

export const metadata = { title: 'Карточка группы' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const id = (await params).id
  const group = await getGroup({
    where: { id: Number(id), organizationId: session.organizationId! },
    include: {
      lessons: {
        include: {
          attendance: {
            include: {
              student: true,
              asMakeupFor: { include: { missedAttendance: { include: { lesson: true } } } },
              missedMakeup: { include: { makeUpAttendance: { include: { lesson: true } } } },
            },
          },
        },
        orderBy: { date: 'asc' },
      },
      location: true,
      course: true,
      schedules: true,
      groupType: { include: { rate: true } },
      teachers: {
        include: {
          teacher: true,
          rate: true,
        },
      },
      students: {
        include: {
          student: true,
        },
      },
    },
  })

  if (!group) {
    return <div>Группа не найдена</div>
  }

  const currentStudents = group.students.map((gs) => gs.student)
  const excludeStudentIds = group.students.map((gs) => gs.studentId)

  const [
    { success: canCreateLesson },
    { success: canCreateStudentGroup },
    { success: canCreateTeacherGroup },
  ] = await Promise.all([
    auth.api.hasPermission({
      headers: requestHeaders,
      body: { permission: { lesson: ['create'] } },
    }),
    auth.api.hasPermission({
      headers: requestHeaders,
      body: { permission: { student: ['create'] } },
    }),
    auth.api.hasPermission({
      headers: requestHeaders,
      body: { permission: { teacherGroup: ['create'] } },
    }),
  ])

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <InfoSection group={group} />
        <Card>
          <CardHeader>
            <CardTitle>Преподаватели</CardTitle>
            {canCreateTeacherGroup && (
              <CardAction>
                <AddTeacherToGroupButton group={group} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <GroupTeachersTable data={group.teachers} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Посещаемость</CardTitle>
          {canCreateLesson && (
            <CardAction>
              <AddLessonButton group={group} />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <GroupAttendanceTable lessons={group.lessons} currentStudents={currentStudents} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Список учеников</CardTitle>
          {canCreateStudentGroup && (
            <CardAction>
              <AddStudentToGroupButton
                group={group}
                excludeStudentIds={excludeStudentIds}
                isFull={group.students.length >= group.maxStudents}
              />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <GroupStudentsTable data={group.students} />
        </CardContent>
      </Card>
    </div>
  )
}
