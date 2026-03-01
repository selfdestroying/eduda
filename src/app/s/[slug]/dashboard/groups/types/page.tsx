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
import CreateGroupTypeDialog from './_components/create-group-type-dialog'
import GroupTypesTable from './_components/group-types-table'

export const metadata = { title: 'Типы групп' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }

  const { success: canManage } = await auth.api.hasPermission({
    headers: requestHeaders,
    body: {
      permissions: { groupType: ['read'] },
    },
  })

  if (!canManage) {
    return <div>У вас нет доступа к этому разделу</div>
  }

  const groupTypes = await prisma.groupType.findMany({
    where: { organizationId: session.organizationId! },
    include: {
      rate: true,
      _count: { select: { groups: true } },
    },
    orderBy: { name: 'asc' },
  })

  const rates = await prisma.rate.findMany({
    where: { organizationId: session.organizationId! },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Типы групп</CardTitle>
          <CardDescription>Управление типами групп и привязка ставок</CardDescription>
          <CardAction>
            <CreateGroupTypeDialog organizationId={session.organizationId!} rates={rates} />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <GroupTypesTable data={groupTypes} rates={rates} />
        </CardContent>
      </Card>
    </div>
  )
}
