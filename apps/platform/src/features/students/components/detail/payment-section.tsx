'use client'

import { StatCard } from '@repo/ui/components/stat-card'
import { getBalanceLabel, getBalanceVariant } from '@/src/features/wallets/utils'
import { BookOpen, Calculator, ReceiptRussianRuble, Wallet } from 'lucide-react'
import type { StudentDetail } from '../../types'

interface PaymentSectionProps {
  student: StudentDetail
}

export default function PaymentSection({ student }: PaymentSectionProps) {
  // Считаем только по кошелькам. Поля на самом ученике — нераспределённый остаток от
  // старой системы учёта: он ни за какой оплатой не стоит и распределить его больше
  // нечем, поэтому складывать его с балансом значит показывать уроки, которых нет.
  const totalPaymentsAggregate = student.wallets.reduce((sum, w) => sum + w.totalPayments, 0)
  const totalLessonsAggregate = student.wallets.reduce((sum, w) => sum + w.totalLessons, 0)
  const totalLessonsBalance = student.wallets.reduce((sum, w) => sum + w.lessonsBalance, 0)

  const avgCost =
    totalLessonsAggregate > 0 ? (totalPaymentsAggregate / totalLessonsAggregate).toFixed(0) : '-'

  const balanceVariant = getBalanceVariant(totalLessonsBalance)

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <ReceiptRussianRuble size={20} />
        Финансы
      </h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Сумма оплат"
          value={`${totalPaymentsAggregate.toLocaleString('ru-RU')} ₽`}
          icon={ReceiptRussianRuble}
        />
        <StatCard
          label="Всего уроков"
          value={totalLessonsAggregate}
          icon={BookOpen}
          hint="Общее количество оплаченных уроков по всем кошелькам ученика."
        />
        <StatCard
          label="Средняя стоимость"
          value={avgCost === '-' ? avgCost : `${Number(avgCost).toLocaleString('ru-RU')} ₽`}
          description={avgCost !== '-' ? 'за урок' : undefined}
          icon={Calculator}
          hint="Средняя цена одного урока = общая сумма оплат / общее количество оплаченных уроков."
        />
        <StatCard
          label="Баланс уроков"
          value={`${totalLessonsBalance} ур.`}
          description={getBalanceLabel(balanceVariant)}
          variant={balanceVariant}
          icon={Wallet}
          hint="Оставшееся количество оплаченных уроков по всем кошелькам. При посещении урока списывается 1 урок. Отрицательный баланс означает долг."
        />
      </div>
    </div>
  )
}
