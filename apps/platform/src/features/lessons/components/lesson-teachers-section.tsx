'use client'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import AddTeacherToLessonButton from './add-teacher-to-lesson-button'
import { useLessonDetail } from './lesson-detail-context'
import LessonTeachersTable from './lesson-teachers-table'

export default function LessonTeachersSection() {
  const { isCancelled } = useLessonDetail()
  const { data: canCreateTeacherLesson } = useOrganizationPermissionQuery({
    teacherLesson: ['create'],
  })

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">Преподаватели</CardTitle>
        {canCreateTeacherLesson?.success && !isCancelled && (
          <CardAction>
            <AddTeacherToLessonButton />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <LessonTeachersTable />
      </CardContent>
    </Card>
  )
}
