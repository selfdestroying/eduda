import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import AddRoleDialog from '@/src/features/organization/roles/components/add-role-dialog'
import RolesList from '@/src/features/organization/roles/components/roles-list'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Роли и доступы' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Роли и доступы</CardTitle>
          <CardDescription>Роли организации и их доступ к разделам приложения</CardDescription>
          <CardAction>
            <AddRoleDialog />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-auto">
          <RolesList />
        </CardContent>
      </Card>
    </div>
  )
}
