import { CartView } from '@/src/features/cart/components/cart-view'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Корзина' }

export default async function CartPage() {
  const session = await getStudentSession(await headers())
  if (!session) redirect('/login')
  if (session.disabledShop) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Корзина</h1>
      <CartView />
    </div>
  )
}
