'use client'

import { createContext, use } from 'react'
import type { LessonDetail } from '../types'

interface LessonDetailContextValue {
  lesson: LessonDetail
  lessonId: number
  isCancelled: boolean
}

const LessonDetailContext = createContext<LessonDetailContextValue | null>(null)

export function LessonDetailProvider({
  lesson,
  children,
}: {
  lesson: LessonDetail
  children: React.ReactNode
}) {
  return (
    <LessonDetailContext
      value={{ lesson, lessonId: lesson.id, isCancelled: lesson.status === 'CANCELLED' }}
    >
      {children}
    </LessonDetailContext>
  )
}

export function useLessonDetail() {
  const ctx = use(LessonDetailContext)
  if (!ctx) throw new Error('useLessonDetail must be used within LessonDetailProvider')
  return ctx
}
