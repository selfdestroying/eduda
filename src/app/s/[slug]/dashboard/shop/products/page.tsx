import { getCategories } from '@/src/actions/categories'
import { getProducts } from '@/src/actions/products'
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
import AddProductButton from './_components/add-product-button'
import ProductsTable from './_components/products-table'

export const metadata = { title: 'Товары' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const products = await getProducts({
    where: { organizationId: session.organizationId! },
    include: { category: true },
    orderBy: { id: 'asc' },
  })
  const categories = await getCategories({
    where: { organizationId: session.organizationId! },
  })

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Товары</CardTitle>
            <CardDescription>Список всех товаров системы</CardDescription>
            <CardAction>
              <AddProductButton categories={categories} />
            </CardAction>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <ProductsTable data={products} categories={categories} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
