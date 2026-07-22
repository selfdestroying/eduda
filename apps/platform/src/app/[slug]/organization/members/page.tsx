import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import CreateMemberDialog from '@/src/features/organization/members/components/create-member-dialog'
import MembersTable from '@/src/features/organization/members/components/members-table'

export const metadata = { title: 'Пользователи' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>Список всех пользователей системы</CardDescription>
          <CardAction>
            <CreateMemberDialog />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <MembersTable />
        </CardContent>
      </Card>
    </div>
  )
}
