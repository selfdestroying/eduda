import { getAchievements } from '@/src/features/achievements/actions'
import { AchievementsView } from '@/src/features/achievements/components/achievements-view'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Достижения' }

// Без фича-гейта: награды дают за учёбу, и выключенный магазин их не прячет —
// как и историю заказов.
export default async function AchievementsPage() {
  const session = await getStudentSession(await headers())
  if (!session) redirect('/login')

  const { data, serverError } = await getAchievements()

  if (serverError || !data) {
    throw new Error(serverError || 'Не удалось загрузить достижения')
  }

  return <AchievementsView items={data} tz={session.org.timezone} />
}
