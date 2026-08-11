import { getCoinHistory, getMonthlyCoinRanking } from '@/src/features/coins/actions'
import { CoinHistory } from '@/src/features/coins/components/coin-history'
import { CoinRanking } from '@/src/features/coins/components/coin-ranking'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { Separator } from '@repo/ui/components/separator'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Астрокоины' }

export default async function CoinsPage() {
  const session = await getStudentSession(await headers())
  if (!session) redirect('/login')

  const [history, ranking] = await Promise.all([
    getCoinHistory({ limit: 50 }),
    getMonthlyCoinRanking(),
  ])

  if (history.serverError || !history.data) {
    throw new Error(history.serverError || 'Не удалось загрузить историю коинов')
  }
  if (ranking.serverError || !ranking.data) {
    throw new Error(ranking.serverError || 'Не удалось загрузить рейтинг')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Астрокоины</h1>
      <CoinHistory
        balance={history.data.balance}
        items={history.data.items}
        tz={session.org.timezone}
      />

      <Separator />

      <CoinRanking
        month={ranking.data.month}
        top={ranking.data.top}
        me={ranking.data.me}
        studentId={session.student.id}
      />
    </div>
  )
}
