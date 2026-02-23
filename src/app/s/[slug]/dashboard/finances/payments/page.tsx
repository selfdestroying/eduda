import { getPayments, getUnprocessedPayments } from '@/src/actions/payments'
import { getStudents } from '@/src/actions/students'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AddPaymentButton from './_components/add-payment-button'
import PaymentsTable from './_components/payments-table'
import UnprocessedPaymentTable from './_components/unprocessed-payment-table'

export const metadata = { title: 'Оплаты' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const payments = await getPayments({
    where: { organizationId: session.organizationId! },
    include: {
      student: true,
      group: { include: { course: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const unprocessedPayments = await getUnprocessedPayments({
    where: { organizationId: session.organizationId! },
    orderBy: { createdAt: 'desc' },
  })
  const students = await getStudents({
    where: { organizationId: session.organizationId! },
    orderBy: { id: 'asc' },
    include: {
      groups: {
        include: {
          group: { include: { course: true, location: true } },
        },
      },
    },
  })

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Оплаты</CardTitle>
          <CardAction>
            <AddPaymentButton students={students} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <PaymentsTable data={payments} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Неразобранное</CardTitle>
        </CardHeader>
        <CardContent>
          <UnprocessedPaymentTable data={unprocessedPayments} students={students} />
        </CardContent>
      </Card>
    </div>
  )
}
