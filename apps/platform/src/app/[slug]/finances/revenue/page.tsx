import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import RevenueChart from '@/src/features/finances/revenue/components/revenue-chart'
import RevenueTable from '@/src/features/finances/revenue/components/revenue-table'

export const metadata = { title: 'Выручка' }

export default function Page() {
  return (
    <div className="space-y-2">
      <RevenueChart />
      <Card>
        <CardHeader>
          <CardTitle>Выручка</CardTitle>
          <CardDescription>
            Занятия, за которые школа считает деньги заработанными: посещения, пропуски без
            предупреждения и засчитанные отработки.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueTable />
        </CardContent>
      </Card>
    </div>
  )
}
