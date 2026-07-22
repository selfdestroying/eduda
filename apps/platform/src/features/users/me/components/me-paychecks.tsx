'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import { ItemGroup } from '@/src/components/ui/item'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useSessionQuery } from '@/src/features/users/me/queries'
import AddCheckButton from '@/src/features/organization/members/components/add-check-button'
import PayChecksTable from '@/src/features/organization/members/components/paychecks-table'
import { useMyPaychecksQuery } from '../queries'

export default function MePaychecks() {
  const { data: session, isLoading: isSessionLoading } = useSessionQuery()
  const { data: paychecks = [], isLoading: isPaychecksLoading } = useMyPaychecksQuery()

  if (isSessionLoading) return <Skeleton className="h-96 w-full" />
  if (!session) return null

  const userId = Number(session.user.id)
  const userName = session.user.name

  return (
    <Card>
      <CardHeader>
        <CardTitle>Чеки</CardTitle>
        <CardDescription>
          {isPaychecksLoading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <>
              <span>Всего чеков: {paychecks.length}</span>
              {' • '}
              <span>
                Сумма:{' '}
                {paychecks.reduce((acc, paycheck) => acc + paycheck.amount, 0).toLocaleString()} ₽
              </span>
            </>
          )}
        </CardDescription>
        <CardAction>
          <AddCheckButton userId={userId} userName={userName} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          <PayChecksTable userId={userId} userName={userName} />
        </ItemGroup>
      </CardContent>
    </Card>
  )
}
