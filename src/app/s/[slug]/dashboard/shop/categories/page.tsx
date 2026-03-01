import { getCategories } from '@/src/actions/categories'
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
import AddCategoryButton from './_components/add-category-button'
import CategoriesTable from './_components/categories-table'

export const metadata = { title: 'Категории' }

export default async function Page() {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }
  const categories = await getCategories({
    where: { organizationId: session.organizationId! },
  })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Категории</CardTitle>
          <CardDescription>Список всех категорий системы</CardDescription>
          <CardAction>
            <AddCategoryButton />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <CategoriesTable data={categories} />
        </CardContent>
      </Card>
    </div>
  )
}
