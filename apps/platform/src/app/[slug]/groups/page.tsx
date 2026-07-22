import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import AddGroupButton from '@/src/features/groups/components/add-group-button'
import GroupsTable from '@/src/features/groups/components/groups-table'

export const metadata = { title: 'Группы' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Группы</CardTitle>
          <CardDescription>Список всех групп системы</CardDescription>
          <CardAction>
            <AddGroupButton />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <GroupsTable />
        </CardContent>
      </Card>
    </div>
  )
}
