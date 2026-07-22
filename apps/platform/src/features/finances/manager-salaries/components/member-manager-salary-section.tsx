'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import { Skeleton } from '@/src/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table'
import { formatDateOnly } from '@/src/lib/timezone'
import { useMemo } from 'react'
import { useManagerSalaryListQuery } from '../queries'
import AddManagerSalaryButton from './add-manager-salary-button'
import ManagerSalaryActions from './manager-salary-actions'

interface Props {
  userId: number
  canEdit: boolean
}

function formatRub(n: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function MemberManagerSalarySection({ userId, canEdit }: Props) {
  const { data: salaries = [], isLoading, isError } = useManagerSalaryListQuery()

  const userSalaries = useMemo(
    () => salaries.filter((s) => s.userId === userId),
    [salaries, userId],
  )

  const active = userSalaries.find((s) => s.endDate === null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Фиксированная зарплата</CardTitle>
        <CardDescription>
          {active
            ? `Текущая ставка: ${formatRub(active.monthlyAmount)} / мес.`
            : 'Активной ставки нет.'}
        </CardDescription>
        {canEdit && (
          <CardAction>
            <AddManagerSalaryButton userId={userId} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : isError ? (
          <div className="text-destructive">Ошибка загрузки</div>
        ) : userSalaries.length === 0 ? (
          <div className="text-muted-foreground text-sm">Нет записей.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>С</TableHead>
                <TableHead>По</TableHead>
                <TableHead className="text-right">Сумма в месяц</TableHead>
                <TableHead>Комментарий</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {userSalaries.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDateOnly(s.startDate)}</TableCell>
                  <TableCell>{s.endDate ? formatDateOnly(s.endDate) : '-'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatRub(s.monthlyAmount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.comment || '-'}</TableCell>
                  {canEdit && (
                    <TableCell className="w-12">
                      <ManagerSalaryActions salary={s} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
