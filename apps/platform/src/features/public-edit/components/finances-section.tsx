'use client'

import { WalletCard } from '@/src/features/wallets/components/wallet-card'
import { Skeleton } from '@repo/ui/components/skeleton'
import { StatCard } from '@repo/ui/components/stat-card'
import { BookOpen, Receipt, Wallet } from 'lucide-react'
import { financeTotals, LOW_BALANCE } from '../lib'
import { usePublicStudentFinancesQuery, useSelectedChild } from '../queries'
import { CabinetEmpty, NoChildren } from './cabinet-empty'

const money = (value: number) => `${value.toLocaleString('ru-RU')} ₽`

export default function FinancesSection({ token }: { token: string }) {
  const { studentId, isPending: childPending } = useSelectedChild(token)
  const { data, isPending, isError } = usePublicStudentFinancesQuery(token, studentId)

  if (!childPending && studentId == null) {
    return <NoChildren />
  }

  if (childPending || isPending) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="col-span-2 h-20 rounded-lg sm:col-span-1" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <CabinetEmpty
        title="Не удалось загрузить финансы"
        description="Попробуйте обновить страницу."
      />
    )
  }

  const { balance, lessons, payments } = financeTotals(data)
  const activeWallets = data.wallets.filter((wallet) => wallet.status === 'ACTIVE')
  const archivedWallets = data.wallets.filter((wallet) => wallet.status === 'ARCHIVED')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Остаток занятий"
          value={balance}
          icon={Wallet}
          variant={balance <= LOW_BALANCE ? 'danger' : 'default'}
        />
        <StatCard label="Всего оплачено занятий" value={lessons} icon={BookOpen} />
        <StatCard
          label="Сумма оплат"
          value={money(payments)}
          icon={Receipt}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {activeWallets.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Кошельки</h2>
            <p className="text-muted-foreground text-xs">Баланс занятий по каждому направлению.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeWallets.map((wallet) => (
              <WalletCard key={wallet.id} wallet={wallet} />
            ))}
          </div>
          {data.lessonsBalance > 0 && (
            <p className="text-muted-foreground text-xs">
              Нераспределённый остаток:{' '}
              <span className="text-foreground font-medium">{data.lessonsBalance} ур.</span>
            </p>
          )}
        </section>
      )}

      {archivedWallets.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Архивные кошельки</h2>
            <p className="text-muted-foreground text-xs">
              Завершённые направления. Доступны только для просмотра.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {archivedWallets.map((wallet) => (
              <WalletCard key={wallet.id} wallet={wallet} />
            ))}
          </div>
        </section>
      )}

      {data.wallets.length === 0 && (
        <CabinetEmpty
          title="Кошельков пока нет"
          description="Они появятся, когда школа оформит первую оплату по направлению."
        />
      )}
    </div>
  )
}
