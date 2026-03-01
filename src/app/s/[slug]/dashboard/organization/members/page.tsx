import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import CreateUserDialog from './_components/create-user-dialog'
import UsersTable from './_components/users-table'

export const metadata = { title: 'Пользователи' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const members = await prisma.member.findMany({
    where: {
      organizationId: session.organizationId!,
      NOT: { userId: Number(session.user.id) },
    },
    include: {
      user: true,
    },
  })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>Список всех пользователей системы</CardDescription>
          <CardAction>
            <CreateUserDialog />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <UsersTable data={members} />
        </CardContent>
      </Card>
    </div>
  )
}
