import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import AddCourseButton from '@/src/features/courses/components/add-course-button'
import CoursesTable from '@/src/features/courses/components/courses-table'

export const metadata = { title: 'Курсы' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Курсы</CardTitle>
          <CardDescription>Управление курсами организации</CardDescription>
          <CardAction>
            <AddCourseButton />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <CoursesTable />
        </CardContent>
      </Card>
    </div>
  )
}
