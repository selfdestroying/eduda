import AddProductButton from '@/src/features/finances/products/components/add-product-button'
import ProductsTable from '@/src/features/finances/products/components/products-table'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'

export const metadata = { title: 'Продукты' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Продукты</CardTitle>
          <CardDescription>Прайс-лист школы: из этих строк собираются оплаты</CardDescription>
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
