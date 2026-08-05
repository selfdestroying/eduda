import { getProfile } from '@/src/features/profile/actions'
import { ProfileView } from '@/src/features/profile/components/profile-view'

// Кеша нет нигде: каталог, остатки и коины пишет другое приложение (§5 SPEC).
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
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
    />
  )
}
