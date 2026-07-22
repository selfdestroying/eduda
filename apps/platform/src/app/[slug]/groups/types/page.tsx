import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Hint } from '@repo/ui/components/hint'
import CreateGroupTypeDialog from '@/src/features/group-types/components/create-group-type-dialog'
import GroupTypesTable from '@/src/features/group-types/components/group-types-table'

export const metadata = { title: 'Типы групп' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>
            Типы групп
            <Hint text="Тип группы определяет ставку преподавателя по умолчанию. При создании группы выбранный тип автоматически подставит привязанную ставку." />
          </CardTitle>
          <CardDescription>Управление типами групп и привязка ставок</CardDescription>
          <CardAction>
            <CreateGroupTypeDialog />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <GroupTypesTable />
        </CardContent>
      </Card>
    </div>
  )
}
