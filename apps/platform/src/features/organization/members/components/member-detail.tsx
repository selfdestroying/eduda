'use client'

import { Avatar, AvatarFallback } from '@/src/components/ui/avatar'
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
import MemberManagerSalarySection from '@/src/features/finances/manager-salaries/components/member-manager-salary-section'
import { OrganizationRole } from '@/src/lib/auth/server'
import { useMemberDetailQuery, usePaycheckListQuery } from '../queries'
import AddCheckButton from './add-check-button'
import EditMemberDialog from './edit-member-dialog'
import PayChecksTable from './paychecks-table'

const memberRoleLabels = {
  owner: 'Владелец',
  manager: 'Менеджер',
  teacher: 'Учитель',
} as const satisfies Record<OrganizationRole, string>

interface MemberDetailProps {
  userId: number
}

export default function MemberDetail({ userId }: MemberDetailProps) {
  const { data: member, isLoading, isError } = useMemberDetailQuery(userId)
  const { data: paychecks = [] } = usePaycheckListQuery(userId)
  const { data: session } = useSessionQuery()

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError) return <div className="text-destructive">Ошибка загрузки</div>
  if (!member) return <div>Сотрудник не найден.</div>

  const roleLabel = memberRoleLabels[member.role as OrganizationRole] ?? member.role ?? '-'
  const viewerRole = session?.memberRole as OrganizationRole | undefined
  const showManagerSalary = member.role === 'manager' || member.role === 'owner'
  const canEditManagerSalary = viewerRole === 'owner'

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback>
                  {member.user.name?.split(' ')[0]?.[0]?.toUpperCase()}
                  {member.user.name?.split(' ')[1]?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {member.user.name}
            </div>
          </CardTitle>
          <CardDescription>
            <span>{roleLabel}</span>
            {' • '}
            <span className={!member.user.banned ? 'text-success' : 'text-destructive'}>
              {!member.user.banned ? 'Активен' : 'Неактивен'}
            </span>
          </CardDescription>
          <CardAction>
            <EditMemberDialog member={member} />
          </CardAction>
        </CardHeader>
        <CardContent />
      </Card>
      {showManagerSalary && (
        <MemberManagerSalarySection userId={member.userId} canEdit={canEditManagerSalary} />
      )}
      <Card>
        <CardHeader>
          <CardTitle>Чеки</CardTitle>
          <CardDescription>
            <span>Всего чеков: {paychecks.length}</span>
            {' • '}
            <span>
              Сумма:{' '}
              {paychecks.reduce((acc, paycheck) => acc + paycheck.amount, 0).toLocaleString()} ₽
            </span>
          </CardDescription>
          <CardAction>
            <AddCheckButton userId={member.userId} userName={member.user.name} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            <PayChecksTable userId={member.userId} userName={member.user.name} />
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  )
}
