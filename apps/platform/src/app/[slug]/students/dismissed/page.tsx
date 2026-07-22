import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import DismissedStatistics from '@/src/features/statistics/components/dismissed/dismissed-statistics'
import DismissedStudentsTable from '@/src/features/students/dismissed/components/dismissed-table'

export const metadata = { title: 'Отчисленные' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2">
      <DismissedStatistics />
      <Card>
        <CardHeader>
          <CardTitle>Ученики</CardTitle>
          <CardDescription>Список всех отчисленных учеников</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <DismissedStudentsTable />
        </CardContent>
      </Card>
    </div>
  )
}
