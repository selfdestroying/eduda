'use client'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import AddAttendanceButton from './add-attendance-button'
import AttendanceTable from './attendance-table'
import { useLessonDetail } from './lesson-detail-context'

export default function AttendanceSection() {
  const { lesson, isCancelled } = useLessonDetail()
  const { data: canCreateStudentLesson } = useOrganizationPermissionQuery({
    studentLesson: ['create'],
  })

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Список учеников</CardTitle>
        {canCreateStudentLesson?.success && !isCancelled && (
          <CardAction>
            <AddAttendanceButton isFull={lesson.attendance.length >= lesson.group.maxStudents} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <AttendanceTable />
      </CardContent>
    </Card>
  )
}
