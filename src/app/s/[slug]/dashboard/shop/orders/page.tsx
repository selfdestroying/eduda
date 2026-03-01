import { getOrders } from '@/src/actions/orders'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import { auth } from '@/src/lib/auth/server'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import OrdersTable from './_components/orders-table'

export const metadata = { title: 'Заказы' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const orders = await getOrders({
    where: { organizationId: session.organizationId! },
    include: { product: true, student: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Заказы</CardTitle>
          <CardDescription>Список всех заказов системы</CardDescription>
          <CardAction></CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <OrdersTable data={orders} />
        </CardContent>
      </Card>
    </div>
  )
}
