import { Card, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import SmartFeedPage from '@/src/features/smart-feed/components/smart-feed-page'
import { auth } from '@/src/lib/auth/server'
import { signInUrl } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Smart Feed' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })

  if (!session || !session.organizationId) {
    redirect(signInUrl)
  }

  if (session.memberRole !== 'owner' && session.memberRole !== 'manager') {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Smart Feed</CardTitle>
            <CardDescription>У вас нет доступа к этому разделу.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return <SmartFeedPage />
}
