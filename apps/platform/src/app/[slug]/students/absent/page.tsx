import AbsentChart from '@/src/features/students/absent/components/absent-chart'
import AbsentTable from '@/src/features/students/absent/components/absent-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'

export const metadata = { title: 'Пропустившие' }

export default function Page() {
  return (
    <div className="space-y-2">
      <AbsentChart />
      <Card>
        <CardHeader>
          <CardTitle>Пропустившие</CardTitle>
          <CardDescription>Ученики, пропустившие занятия.</CardDescription>
        </CardHeader>
        <CardContent>
          <AbsentTable />
        </CardContent>
      </Card>
    </div>
  )
}
