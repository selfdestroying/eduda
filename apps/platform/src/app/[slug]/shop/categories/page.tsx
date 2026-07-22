import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import AddCategoryButton from '@/src/features/shop/categories/components/add-category-button'
import CategoriesTable from '@/src/features/shop/categories/components/categories-table'

export const metadata = { title: 'Категории' }

export default function Page() {
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
          <CategoriesTable />
        </CardContent>
      </Card>
    </div>
  )
}
