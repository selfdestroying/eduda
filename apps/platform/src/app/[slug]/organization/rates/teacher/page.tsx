import { Hint } from '@repo/ui/components/hint'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import CreateRateDialog from '@/src/features/organization/rates/components/create-rate-dialog'
import RatesTable from '@/src/features/organization/rates/components/rates-table'

export const metadata = { title: 'Ставки преподавателей' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>
            Ставки преподавателей
            <Hint text="Ставки преподавателей определяют оплату за проведённые уроки. Ставка включает базовую сумму за урок и опциональный бонус за каждого присутствующего ученика." />
          </CardTitle>
          <CardDescription>Управление ставками преподавателей</CardDescription>
          <CardAction>
            <CreateRateDialog />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <RatesTable />
        </CardContent>
      </Card>
    </div>
  )
}
