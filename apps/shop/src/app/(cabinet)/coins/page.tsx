import { getCoinHistory } from '@/src/features/coins/actions'
import { CoinHistory } from '@/src/features/coins/components/coin-history'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Астрокоины' }

export default async function CoinsPage() {
  const session = await getStudentSession(await headers())
  if (!session) redirect('/login')

  const { data, serverError } = await getCoinHistory({ limit: 50 })

  if (serverError || !data) {
    throw new Error(serverError || 'Не удалось загрузить историю коинов')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Астрокоины</h1>
      <CoinHistory balance={data.balance} items={data.items} tz={session.org.timezone} />
    </div>
  )
}
