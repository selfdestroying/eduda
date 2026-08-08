import FinancesSection from '@/src/features/public-edit/components/finances-section'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Финансы' }

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token } = await params

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Финансы</h1>
      <FinancesSection token={token} />
    </div>
  )
}
