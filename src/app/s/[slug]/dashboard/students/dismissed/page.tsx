import { getDismissedStatistics } from '@/src/actions/dismissed'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DismissedStudentsTable from './_components/dismissed-table'
import DismissedStatistics from './statistics/dismissed-statistics'

export const metadata = { title: 'Отчисленные' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const dismissed = await prisma.dismissed.findMany({
    where: {
      organizationId: session.organizationId!,
    },
    include: {
      group: {
        include: {
          course: true,
          location: true,
          teachers: { include: { teacher: { include: { members: true } } } },
        },
      },
      student: true,
    },
    orderBy: { date: 'desc' },
  })

  const statistics = await getDismissedStatistics(session.organizationId!)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2">
      <DismissedStatistics {...statistics} />
      <Card>
        <CardHeader>
          <CardTitle>Ученики</CardTitle>
          <CardDescription>Список всех отчисленных учеников</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <DismissedStudentsTable data={dismissed} />
        </CardContent>
      </Card>
    </div>
  )
}
