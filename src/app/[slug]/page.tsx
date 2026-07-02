import { HOME_VIEW_CALENDAR, HOME_VIEW_COOKIE } from '@/src/features/calendar/lib/view-preference'
import { auth } from '@/src/lib/auth/server'
import { protocol, rootDomain } from '@/src/lib/utils'
import { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Dashboard from '../../features/dashboard/components/dashboard'

export const metadata: Metadata = { title: 'Панель управления' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }

  // Пользователь включил новый вид — главная сразу открывает календарь.
  const cookieStore = await cookies()
  if (cookieStore.get(HOME_VIEW_COOKIE)?.value === HOME_VIEW_CALENDAR) {
    redirect('/calendar')
  }

  return <Dashboard />
}
