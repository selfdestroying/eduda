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
import CreateRateDialog from './_components/create-rate-dialog'
import RatesTable from './_components/rates-table'

export const metadata = { title: 'Ставки' }

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
      permissions: { rate: ['read'] },
    },
  })

  if (!canManage) {
    return <div>У вас нет доступа к этому разделу</div>
  }

  const rates = await prisma.rate.findMany({
    where: { organizationId: session.organizationId! },
    include: { _count: { select: { teacherGroups: true } } },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Ставки</CardTitle>
          <CardDescription>Управление ставками преподавателей</CardDescription>
          <CardAction>
            <CreateRateDialog organizationId={session.organizationId!} />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <RatesTable data={rates} />
        </CardContent>
      </Card>
    </div>
  )
}
