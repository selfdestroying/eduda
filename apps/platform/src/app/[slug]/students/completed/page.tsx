import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import CompletedStudentsTable from '@/src/features/students/completed/components/completed-students-table'
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
          <CompletedStudentsTable />
        </CardContent>
      </Card>
    </div>
  )
}
