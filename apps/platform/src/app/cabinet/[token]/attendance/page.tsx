import AttendanceSection from '@/src/features/public-edit/components/attendance-section'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Посещаемость' }

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token } = await params

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Посещаемость</h1>
      <AttendanceSection token={token} />
    </div>
  )
}
