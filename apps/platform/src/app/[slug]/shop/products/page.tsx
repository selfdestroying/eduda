import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import AddProductButton from '@/src/features/shop/products/components/add-product-button'
import ProductsTable from '@/src/features/shop/products/components/products-table'

export const metadata = { title: 'Товары' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Товары</CardTitle>
          <CardDescription>Список всех товаров системы</CardDescription>
          <CardAction>
            <AddProductButton />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <ProductsTable />
        </CardContent>
      </Card>
    </div>
  )
}
