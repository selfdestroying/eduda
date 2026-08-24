import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import ActiveStatistics from '@/src/features/statistics/components/active/active-statistics'
import EnrollmentsTable from '@/src/features/students/enrollments/components/enrollments-table'

export const metadata = { title: 'Активные ученики' }

/**
 * Пробные считаются активными: ученик ходит на занятия, и его место в группе
 * занято — отделять их отдельной страницей нечем.
 */
const ACTIVE_STATUSES = ['ACTIVE', 'TRIAL'] as const

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
          <EnrollmentsTable
            statuses={[...ACTIVE_STATUSES]}
            tableId="active-students"
            emptyMessage="Нет активных учеников."
          />
        </CardContent>
      </Card>
    </div>
  )
}
