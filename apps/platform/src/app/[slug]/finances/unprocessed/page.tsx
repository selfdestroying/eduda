import { Hint } from '@/src/components/hint'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import UnprocessedPaymentTable from '@/src/features/finances/payments/components/unprocessed-payment-table'

export default async function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Неразобранное
          <Hint
            text="Оплаты, которые поступили из CRM, но не были автоматически привязаны к ученику. Требуют ручной обработки."
            variant="warning"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <UnprocessedPaymentTable />
      </CardContent>
    </Card>
  )
}
