import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import ActiveStatistics from '@/src/features/statistics/components/active/active-statistics'
import ActiveStudentsTable from '@/src/features/students/active/components/active-students-table'

export const metadata = { title: 'Активные ученики' }

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-2">
      <ActiveStatistics />
      <Card>
        <CardHeader>
          <CardTitle>Активные ученики</CardTitle>
          <CardDescription>Список всех активных учеников системы</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <ActiveStudentsTable />
        </CardContent>
      </Card>
    </div>
  )
}
