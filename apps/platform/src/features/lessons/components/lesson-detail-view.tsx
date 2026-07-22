'use client'

import { Skeleton } from '@/src/components/ui/skeleton'
import { useLessonDetailQuery } from '../queries'
import AttendanceSection from './attendance-section'
import InfoSection from './info-section'
import { LessonDetailProvider } from './lesson-detail-context'
import LessonTeachersSection from './lesson-teachers-section'

export default function LessonDetailView({ lessonId }: { lessonId: number }) {
  const { data: lesson, isLoading, isError } = useLessonDetailQuery(lessonId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (isError || !lesson) {
    return <div className="text-destructive">Ошибка при получении урока</div>
  }

  return (
    <LessonDetailProvider lesson={lesson}>
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <InfoSection />
          <LessonTeachersSection />
        </div>
        <AttendanceSection />
      </div>
    </LessonDetailProvider>
  )
}
