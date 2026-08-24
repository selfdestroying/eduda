import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import EnrollmentsTable from '@/src/features/students/enrollments/components/enrollments-table'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Завершившие ученики' }

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-2">
      <Card>
        <CardHeader>
          <CardTitle>Завершившие ученики</CardTitle>
          <CardDescription>Список всех учеников, завершивших обучение</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <EnrollmentsTable
            statuses={['COMPLETED']}
            tableId="completed-students"
            emptyMessage="Нет завершивших учеников."
          />
        </CardContent>
      </Card>
    </div>
  )
}
