import { Calendar } from '@/src/features/calendar/components/calendar'
import { auth } from '@/src/lib/auth/server'
import { signInUrl } from '@/src/lib/utils'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Календарь' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session) {
    redirect(signInUrl)
  }

  // Главная — календарь, у всех и без выбора. Классическая панель управления
  // (`src/features/dashboard/`, кука `home_view`, «Старый вид») осталась в коде,
  // но больше никуда не ведёт.
  //
  // Рендерим на месте, а не через redirect('/calendar'): серверный редирект с
  // часто префетчируемого «/» ломал RSC-навигацию (ошибка "Failed to load page"
  // при входе и переходах на главную).
  return <Calendar />
}
