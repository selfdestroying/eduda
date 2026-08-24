import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import AddPackageButton from '@/src/features/finances/payments/components/add-package-button'
import PackagesTable from '@/src/features/finances/payments/components/packages-table'

export const metadata = { title: 'Пакеты' }

export default function Page() {
  return (
    <div className="space-y-2">
      <Card>
        {/* Раскладку шапки держит сетка `CardHeader`: она сама ставит кнопку
            справа от заголовка с описанием. `flex justify-between` поставил бы
            описание в один ряд с ними. */}
        <CardHeader>
          <CardTitle>Пакеты</CardTitle>
          <CardDescription>Пакеты занятий, проданные ученикам.</CardDescription>
          <CardAction>
            <AddPackageButton />
          </CardAction>
        </CardHeader>
        <CardContent>
          <PackagesTable />
        </CardContent>
      </Card>
    </div>
  )
}
