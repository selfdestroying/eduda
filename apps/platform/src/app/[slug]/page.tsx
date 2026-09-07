import { Calendar } from '@/src/features/calendar/components/calendar'
import Dashboard from '@/src/features/dashboard/components/dashboard'
import { auth } from '@/src/lib/auth/server'
import { isFeatureDisabled } from '@/src/lib/features/registry'
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

  // Главная — календарь, но школа может остаться на старой панели управления:
  // фича `home.calendar`, выключается строкой в `OrganizationFeature`.
  //
  // Рендерим на месте, а не через redirect('/calendar'): серверный редирект с
  // часто префетчируемого «/» ломал RSC-навигацию (ошибка "Failed to load page"
  // при входе и переходах на главную).
  if (isFeatureDisabled(session.disabledFeatures, 'home.calendar')) {
    return <Dashboard />
  }

  return <Calendar />
}
