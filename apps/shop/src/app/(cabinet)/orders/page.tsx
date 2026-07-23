import { getOrders } from '@/src/features/orders/actions'
import { OrdersList } from '@/src/features/orders/components/orders-list'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Заказы' }

// Без фича-гейта: история уже совершённых покупок остаётся видимой, даже когда
// школа выключила магазин.
export default async function OrdersPage() {
  const session = await getStudentSession(await headers())
  if (!session) redirect('/login')

  const { data, serverError } = await getOrders()

  if (serverError || !data) {
    throw new Error(serverError || 'Не удалось загрузить заказы')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Мои заказы</h1>
      <OrdersList orders={data} tz={session.org.timezone} />
    </div>
  )
}
