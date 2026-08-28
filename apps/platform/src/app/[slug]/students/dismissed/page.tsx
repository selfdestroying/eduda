import DismissedChart from '@/src/features/students/enrollments/components/dismissed-chart'
import DismissedTable from '@/src/features/students/enrollments/components/dismissed-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'

export const metadata = { title: 'Отчисленные' }

/**
 * Один id на график и таблицу: отбор у них общий и живёт в адресной строке, а по
 * этому ключу лежит видимость колонок.
 */
const TABLE_ID = 'dismissed'

export default function Page() {
  return (
    <div className="space-y-2">
      <DismissedChart tableId={TABLE_ID} />
      <Card>
        <CardHeader>
          <CardTitle>Отчисленные</CardTitle>
          <CardDescription>Ученики, отчисленные из групп.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <DismissedTable tableId={TABLE_ID} />
        </CardContent>
      </Card>
    </div>
  )
}
