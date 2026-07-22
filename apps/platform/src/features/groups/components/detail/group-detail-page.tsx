'use client'

import { Hint } from '@/src/components/hint'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { useGroupDetailPageQuery } from '../../queries'
import AddLessonButton from './add-lesson-button'
import AddStudentToGroupButton from './add-student-to-group-button'
import AddTeacherToGroupButton from './add-teacher-to-group-button'
import { GroupAttendanceTable } from './group-attendance-table'
import GroupStudentsTable from './group-students-table'
import GroupTeachersTable from './group-teachers-table'
import InfoSection from './info-section'

export default function GroupDetailPage({ groupId }: { groupId: number }) {
  const { data: group, isLoading, isError } = useGroupDetailPageQuery(groupId)

  const { data: canCreateLesson } = useOrganizationPermissionQuery({ lesson: ['create'] })
  const { data: canCreateStudentGroup } = useOrganizationPermissionQuery({ student: ['create'] })
  const { data: canCreateTeacherGroup } = useOrganizationPermissionQuery({
    teacherGroup: ['create'],
  })
  const { data: canArchive } = useOrganizationPermissionQuery({ group: ['update'] })

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (isError || !group) {
    return <div className="text-destructive">Группа не найдена</div>
  }

  const currentStudents = group.students.map((gs) => gs.student)
  const excludeStudentIds = group.students.map((gs) => gs.studentId)
  const isActive = group.status === 'ACTIVE'

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <InfoSection group={group} canArchive={canArchive?.success} />
        <Card>
          <CardHeader>
            <CardTitle>Преподаватели</CardTitle>
            {canCreateTeacherGroup?.success && isActive && (
              <CardAction>
                <AddTeacherToGroupButton group={group} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <GroupTeachersTable data={group.teachers} isActive={isActive} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Посещаемость
            <Hint text="Зелёный - присутствовал, красный - пропустил, градиент - пробный ученик. Контур ячейки показывает статус отработки." />
          </CardTitle>
          {canCreateLesson?.success && isActive && (
            <CardAction>
              <AddLessonButton groupId={group.id} />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <GroupAttendanceTable
            lessons={group.lessons}
            currentStudents={currentStudents}
            groupId={group.id}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Список учеников</CardTitle>
          {canCreateStudentGroup?.success && isActive && (
            <CardAction>
              <AddStudentToGroupButton
                groupId={group.id}
                excludeStudentIds={excludeStudentIds}
                isFull={group.students.length >= group.maxStudents}
              />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <GroupStudentsTable data={group.students} isActive={isActive} />
        </CardContent>
      </Card>
    </div>
  )
}
