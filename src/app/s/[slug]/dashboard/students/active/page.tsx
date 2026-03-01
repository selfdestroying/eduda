import { getActiveStudentStatistics } from '@/src/actions/students'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ActiveStudentsTable from './_components/active-students-table'
import ActiveStatistics from './statistics/active-statistics'

export const metadata = { title: 'Активные ученики' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }

  const students = await prisma.studentGroup.findMany({
    where: { organizationId: session.organizationId! },
    include: {
      group: {
        include: {
          location: true,
          course: true,
          teachers: {
            include: {
              teacher: true,
            },
          },
        },
      },
      student: {
        include: {
          payments: true,
        },
      },
    },
  })
  const statistics = await getActiveStudentStatistics(session.organizationId!)

  return (
    <div className="grid grid-cols-1 gap-2">
      <ActiveStatistics {...statistics} />
      <Card>
        <CardHeader>
          <CardTitle>Активные ученики</CardTitle>
          <CardDescription>Список всех активных учеников системы</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <ActiveStudentsTable data={students} />
        </CardContent>
      </Card>
    </div>
  )
}
