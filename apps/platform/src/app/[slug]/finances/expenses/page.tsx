import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import AddExpenseButton from '@/src/features/finances/expenses/components/add-expense-button'
import ExpenseTable from '@/src/features/finances/expenses/components/expense-table'

export const metadata = { title: 'Прочие расходы' }

export default function Page() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Прочие расходы</CardTitle>
          <CardDescription>Управление прочими расходами организации</CardDescription>
          <CardAction>
            <AddExpenseButton />
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <ExpenseTable />
        </CardContent>
      </Card>
    </div>
  )
}
