import { getProduct } from '@/src/features/catalog/actions'
import { ProductDetail } from '@/src/features/catalog/components/product-detail'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession(await headers())
  if (!session) redirect('/login')
  if (session.disabledShop) notFound()

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const { data } = await getProduct({ id })
  // Архив, чужая школа и несуществующий id неотличимы снаружи — везде 404.
  if (!data) notFound()

  const { inCart, ...product } = data
  return <ProductDetail product={product} inCart={inCart} />
}
