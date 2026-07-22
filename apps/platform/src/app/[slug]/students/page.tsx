import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import AddStudentButton from '@/src/features/students/components/add-student-button'
import StudentsTable from '@/src/features/students/components/students-table'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ученики' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Ученики</CardTitle>
          <CardDescription>Список всех учеников системы</CardDescription>
          <CardAction>
            <AddStudentButton />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <StudentsTable />
        </CardContent>
      </Card>
    </div>
  )
}
