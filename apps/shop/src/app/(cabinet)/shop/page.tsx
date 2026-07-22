import { getCatalog, getCategories } from '@/src/features/catalog/actions'
import { CatalogView } from '@/src/features/catalog/components/catalog-view'
import { getStudentSession } from '@/src/lib/auth/student-session'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Магазин' }

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const session = await getStudentSession(await headers())
  if (!session) redirect('/login')
  // Фича выключена школой — роут не должен отдавать 200 (§11.5).
  if (session.disabledShop) notFound()

  const raw = Number((await searchParams).category)
  const categoryId = Number.isInteger(raw) && raw > 0 ? raw : undefined

  const [catalog, categories] = await Promise.all([getCatalog({ categoryId }), getCategories()])

  if (catalog.serverError || !catalog.data) {
    throw new Error(catalog.serverError || 'Не удалось загрузить каталог')
  }

  return (
    <CatalogView
      products={catalog.data}
      categories={categories.data ?? []}
      activeCategoryId={categoryId ?? null}
    />
  )
}
