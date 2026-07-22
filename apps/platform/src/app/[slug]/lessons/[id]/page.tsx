import LessonDetailView from '@/src/features/lessons/components/lesson-detail-view'

export const metadata = { title: 'Карточка урока' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return <LessonDetailView lessonId={+id} />
}
