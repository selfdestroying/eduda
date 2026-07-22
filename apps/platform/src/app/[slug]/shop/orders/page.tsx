import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import OrdersTable from '@/src/features/shop/orders/components/orders-table'

export const metadata = { title: 'Заказы' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Заказы</CardTitle>
          <CardDescription>Список всех заказов системы</CardDescription>
          <CardAction></CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <OrdersTable />
        </CardContent>
      </Card>
    </div>
  )
}
