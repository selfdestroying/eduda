'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import AddManagerSalaryButton from './add-manager-salary-button'
import ManagerRatesTable from './manager-salaries-table'

export default function ManagerRates() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ставки менеджеров</CardTitle>
        <CardDescription>История фиксированных ставок по каждому менеджеру.</CardDescription>
        <CardAction>
          <AddManagerSalaryButton />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ManagerRatesTable />
      </CardContent>
    </Card>
  )
}
