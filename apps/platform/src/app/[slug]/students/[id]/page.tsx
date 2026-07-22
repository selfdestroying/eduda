import StudentDetailPage from '@/src/features/students/components/detail/student-detail-page'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Карточка ученика' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StudentDetailPage studentId={Number(id)} />
}
