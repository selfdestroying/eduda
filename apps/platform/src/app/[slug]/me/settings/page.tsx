import ChangePasswordCard from '@/src/features/users/me/components/change-password-card'
import SessionsCard from '@/src/features/users/me/components/sessions-card'

export const metadata = { title: 'Настройки' }

export default function Page() {
  return (
    <div className="space-y-2">
      <SessionsCard />
      <ChangePasswordCard />
    </div>
  )
}
