import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import AddPaymentMethodButton from '@/src/features/finances/payment-methods/components/add-payment-method-button'
import PaymentMethodsTable from '@/src/features/finances/payment-methods/components/payment-methods-table'

export const metadata = { title: 'Методы оплаты' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Методы оплаты</CardTitle>
          <CardDescription>Управление методами оплаты организации</CardDescription>
          <CardAction>
            <AddPaymentMethodButton />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <PaymentMethodsTable />
        </CardContent>
      </Card>
    </div>
  )
}
