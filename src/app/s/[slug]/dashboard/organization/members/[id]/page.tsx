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
import { auth, OrganizationRole } from '@/src/lib/auth'
import prisma from '@/src/lib/prisma'
import { protocol, rootDomain } from '@/src/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import EditUserButton from '../_components/edit-user-dialog'
import AddCheckButton from './_components/add-check-button'
import PayChecksTable from './_components/paycheks-table'

export const metadata = { title: 'Карточка пользователя' }

const memberRoleLabels = {
  owner: 'Владелец',
  manager: 'Менеджер',
  teacher: 'Учитель',
} as const satisfies Record<OrganizationRole, string>

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
  })
  if (!session || !session.organizationId) {
    redirect(`${protocol}://auth.${rootDomain}/sign-in`)
  }

  const { success: canRead } = await auth.api.hasPermission({
    headers: requestHeaders,
    body: {
      permission: { member: ['read'] },
    },
  })

  if (!canRead) {
    return <div>У вас нет доступа к этому разделу</div>
  }

  const { id } = await params
  const member = await prisma.member.findFirst({
    where: {
      userId: Number(id),
      organizationId: session.organizationId!,
    },
    include: {
      user: true,
    },
  })

  if (!member) {
    return <div>Сотрудник не найден.</div>
  }

  const paychecks = await prisma.payCheck.findMany({
    where: {
      userId: member.userId,
      organizationId: session.organizationId!,
    },
    orderBy: { date: 'asc' },
  })

  const roleLabel = memberRoleLabels[member.role as OrganizationRole] ?? member.role ?? '-'
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
            <EditUserButton member={member} />
          </CardAction>
        </CardHeader>
        <CardContent />
      </Card>
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
            <AddCheckButton
              organizationId={session.organizationId!}
              userId={member.userId}
              userName={member.user.name}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            <PayChecksTable data={paychecks} userName={member.user.name} />
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  )
}
