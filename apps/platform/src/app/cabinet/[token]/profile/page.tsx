import ProfileSection from '@/src/features/public-edit/components/profile-section'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Профиль' }

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token } = await params

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Профиль</h1>
      <ProfileSection token={token} />
    </div>
  )
}
