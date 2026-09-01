import { getProfile } from '@/src/features/profile/actions'
import { ProfileView } from '@/src/features/profile/components/profile-view'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { isKnowledgeDay } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

// Кеша нет нигде: каталог, остатки и коины пишет другое приложение (§5 SPEC).
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  // Сессия нужна только ради пояса школы: «сегодня» считается по её часам.
  // Гейт здесь дублирует layout — без него не сузить тип.
  const session = await getStudentSession(await headers())
  if (!session) redirect('/login')

  const { data, serverError } = await getProfile()

  if (serverError || !data) {
    throw new Error(serverError || 'Не удалось загрузить профиль')
  }

  return (
    <ProfileView
      student={data.student}
      groups={data.groups}
      parents={data.parents}
      coins={data.coins}
      knowledgeDay={isKnowledgeDay(session.org.timezone)}
    />
  )
}
