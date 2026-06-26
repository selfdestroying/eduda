'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Skeleton } from '@/src/components/ui/skeleton'
import { WalletCard } from '@/src/features/wallets/components/wallet-card'
import { usePublicStudentFinancesQuery } from '../queries'

const money = (value: number) => `${value.toLocaleString('ru-RU')} ₽`

export default function FinancesTab({ token, studentId }: { token: string; studentId: number }) {
  const { data, isPending, isError } = usePublicStudentFinancesQuery(token, studentId)

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Не удалось загрузить финансовую информацию. Попробуйте обновить страницу.
        </CardContent>
      </Card>
    )
  }

  const { lessonsBalance, totalLessons, totalPayments, wallets } = data

  const activeWallets = wallets.filter((wallet) => wallet.status === 'ACTIVE')
  const archivedWallets = wallets.filter((wallet) => wallet.status === 'ARCHIVED')

  // Реальный баланс = нераспределённый остаток (наследие старой системы)
  // + суммы по всем кошелькам.
  const totalBalance =
    lessonsBalance + wallets.reduce((sum, wallet) => sum + wallet.lessonsBalance, 0)
  const totalLessonsAll =
    totalLessons + wallets.reduce((sum, wallet) => sum + wallet.totalLessons, 0)
  const totalPaymentsAll =
    totalPayments + wallets.reduce((sum, wallet) => sum + wallet.totalPayments, 0)

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
        <CardHeader>
          <CardTitle>Баланс</CardTitle>
          <CardDescription>Остаток оплаченных уроков и сумма оплат.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Остаток уроков" value={String(totalBalance)} />
            <StatTile label="Всего уроков оплачено" value={String(totalLessonsAll)} />
            <StatTile label="Сумма оплат" value={money(totalPaymentsAll)} />
          </div>
        </CardContent>
      </Card>

      {activeWallets.length > 0 && (
        <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
          <CardHeader>
            <CardTitle>Кошельки</CardTitle>
            <CardDescription>Баланс уроков по каждому направлению.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeWallets.map((wallet) => (
                <WalletCard key={wallet.id} wallet={wallet} />
              ))}
            </div>

            {lessonsBalance > 0 && (
              <p className="text-muted-foreground mt-3 text-xs">
                Нераспределённый остаток:{' '}
                <span className="text-foreground font-medium">{lessonsBalance} ур.</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {archivedWallets.length > 0 && (
        <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
          <CardHeader>
            <CardTitle>Архивные кошельки</CardTitle>
            <CardDescription>
              Завершённые направления. Доступны только для просмотра.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {archivedWallets.map((wallet) => (
                <WalletCard key={wallet.id} wallet={wallet} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 bg-background/40 rounded-xl border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
