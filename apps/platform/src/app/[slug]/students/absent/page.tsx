import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import AbsentStatistics from '@/src/features/statistics/components/absent/absent-statistics'
import AbsentAttendanceTable from '@/src/features/students/absent/components/absent-attendance-table'

export const metadata = { title: 'Пропустившие' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2">
      <AbsentStatistics />
      <Card>
        <CardHeader>
          <CardTitle>Ученики</CardTitle>
          <CardDescription>Список всех учеников системы</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <AbsentAttendanceTable />
        </CardContent>
      </Card>
    </div>
  )
}
