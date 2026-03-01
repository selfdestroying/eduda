import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import { ItemGroup } from '@/src/components/ui/item'
import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AddCheckButton from '../dashboard/organization/members/[id]/_components/add-check-button'
import PayChecksTable from '../dashboard/organization/members/[id]/_components/paycheks-table'
import UserCard from './_components/user-card'

export const metadata = { title: 'Профиль' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const activeSessions = await auth.api.listSessions({
    headers: requestHeaders,
  })

  const paychecks = await prisma.payCheck.findMany({
    where: {
      userId: Number(session.user.id),
      organizationId: session.organizationId!,
    },
  })
  return (
    <div className="space-y-2">
      <UserCard session={session} activeSessions={activeSessions} />
      <Card>
        <CardHeader>
          <CardTitle>Чеки</CardTitle>
          <CardDescription>
            <span>Всего чеков: {paychecks.length}</span>
            {' • '}
            <span>
              Сумма:{' '}
              {paychecks.reduce((acc, paycheck) => acc + paycheck.amount, 0).toLocaleString()} ₽
            </span>
          </CardDescription>
          <CardAction>
            <AddCheckButton
              organizationId={session.organizationId!}
              userId={Number(session.user.id)}
              userName={session.user.name}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            <PayChecksTable data={paychecks} userName={session.user.name} />
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  )
}
