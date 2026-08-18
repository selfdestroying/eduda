import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import AddPackageButton from '@/src/features/finances/payments/components/add-package-button'
import PackagesTable from '@/src/features/finances/payments/components/packages-table'

export const metadata = { title: 'Пакеты' }

export default function Page() {
  return (
    <div className="space-y-2">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Пакеты</CardTitle>
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
