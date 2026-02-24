import { getStudents } from '@/src/actions/students'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import CreateStudentDialog from './_components/create-student-dialog'
import StudentsTable from './_components/students-table'

export const metadata = { title: 'Ученики' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const students = await getStudents({
    where: {
      organizationId: session.organizationId!,
    },
    include: {
      groups: true,
    },
  })

  const { success: canCreate } = await auth.api.hasPermission({
    headers: requestHeaders,
    body: {
      permission: { student: ['create'] },
    },
  })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Ученики</CardTitle>
          <CardDescription>Список всех учеников системы</CardDescription>
          {canCreate && (
            <CardAction>
              <CreateStudentDialog />
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="overflow-hidden">
          <StudentsTable data={students} />
        </CardContent>
      </Card>
    </div>
  )
}
