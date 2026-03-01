import { auth } from '@/src/lib/auth/server'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })

  const redirectURL = session?.organization
    ? `${protocol}://${session.organization.slug}.${rootDomain}`
    : '/sign-in'

  return redirect(redirectURL)
}
