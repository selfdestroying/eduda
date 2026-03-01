import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth/server'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import CreateGroupForm from './_components/create-group-form'

export const metadata = { title: 'Создать группу' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }

  const { success: canCreate } = await auth.api.hasPermission({
    headers: requestHeaders,
    body: {
      permissions: { group: ['create'] },
    },
  })

  if (!canCreate) {
    redirect('/dashboard/groups')
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Создать группу</CardTitle>
          <CardDescription>Заполните форму ниже, чтобы создать новую группу.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateGroupForm />
        </CardContent>
      </Card>
    </div>
  )
}
