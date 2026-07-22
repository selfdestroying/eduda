import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import TaxSystemConfig from '@/src/features/organization/tax-systems/components/tax-system-config'

export const metadata = { title: 'Системы налогообложения' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Системы налогообложения</CardTitle>
          <CardDescription>
            Выберите и настройте систему налогообложения для вашей организации
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxSystemConfig />
        </CardContent>
      </Card>
    </div>
  )
}
