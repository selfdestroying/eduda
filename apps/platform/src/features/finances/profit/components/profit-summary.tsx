'use client'

import { StatCard } from '@/src/components/stat-card'
import {
  Banknote,
  Building2,
  CreditCard,
  Landmark,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { ProfitData } from '../types'
import { formatCurrency } from '@/src/lib/utils'

function pct(part: number, total: number) {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

interface ProfitSummaryProps {
  data: ProfitData
}

export default function ProfitSummary({ data }: ProfitSummaryProps) {
  const { revenue, taxes, acquiring, salaries, rent, expenses, profit } = data
  const isPositive = profit >= 0

  return (
    <div className="space-y-2">
      {/* Revenue */}
      <div className="grid grid-cols-1 gap-2">
        <StatCard
          label="Выручка за период"
          value={formatCurrency(revenue)}
          icon={Banknote}
          variant="default"
          hint="Сумма стоимости всех платных посещений за период. Рассчитывается как: оплата ученика / кол-во уроков в кошельке × кол-во посещений"
        />
      </div>

      {/* Expenses */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard
          label="Налоги"
          value={formatCurrency(taxes.total)}
          description={`${pct(taxes.total, revenue)} от выручки · ${taxes.breakdown.taxSystemLabel}`}
          icon={Landmark}
          variant="default"
          hint={`Рассчитано по системе «${taxes.breakdown.taxSystemLabel}». Налог на доход: ${formatCurrency(taxes.breakdown.incomeTax)} (${taxes.breakdown.incomeTaxRate}%). Страховые: ${formatCurrency(taxes.breakdown.insuranceContributions)}. Фиксированные взносы: ${formatCurrency(taxes.breakdown.fixedContributions)}`}
        />
        <StatCard
          label="Эквайринг"
          value={formatCurrency(acquiring.total)}
          description={`${pct(acquiring.total, revenue)} от выручки · ${acquiring.breakdown.length} мет. оплаты`}
          icon={CreditCard}
          variant="default"
          hint="Комиссии платёжных систем. Рассчитывается для каждого метода оплаты как: сумма оплат × комиссия %"
        />
        <StatCard
          label="Зарплаты"
          value={formatCurrency(salaries.total)}
          description={`${pct(salaries.total, revenue)} от выручки · ${salaries.teacherCount} преп. · ${salaries.managerCount} мен.`}
          icon={Users}
          variant="default"
          hint={`Общая сумма зарплат за период. Уроки преподавателей: ${formatCurrency(salaries.totalFromLessons)} (${salaries.lessonCount} ур.). Начисления преподавателям: ${formatCurrency(salaries.totalFromPaychecks)}. Фикс. зарплаты менеджеров: ${formatCurrency(salaries.totalFromManagerFixed)}. Начисления менеджерам: ${formatCurrency(salaries.totalFromManagerPaychecks)}`}
        />
        <StatCard
          label="Аренда"
          value={formatCurrency(rent.total)}
          description={`${pct(rent.total, revenue)} от выручки · ${rent.breakdown.length} лок.`}
          icon={Building2}
          variant="default"
          hint={`Аренда помещений за период. ${rent.breakdown.map((r) => `${r.locationName}: ${formatCurrency(r.amount)}`).join(', ') || 'Нет данных'}`}
        />
        <StatCard
          label="Прочие расходы"
          value={formatCurrency(expenses.total)}
          description={`${pct(expenses.total, revenue)} от выручки · ${expenses.breakdown.length} позиц.`}
          icon={Receipt}
          variant="default"
          hint={`Прочие операционные расходы. ${expenses.breakdown.map((e) => `${e.name}: ${formatCurrency(e.amount)}`).join(', ') || 'Нет данных'}`}
        />
      </div>

      {/* Profit - highlighted */}
      <div className="grid grid-cols-1 gap-2">
        <StatCard
          label="Чистая прибыль"
          value={formatCurrency(profit)}
          description={`${pct(Math.abs(profit), revenue)} от выручки`}
          icon={isPositive ? TrendingUp : TrendingDown}
          variant={isPositive ? 'success' : 'danger'}
          hint="Прибыль = Выручка − Налоги − Эквайринг − Зарплаты − Аренда − Прочие расходы"
        />
      </div>
    </div>
  )
}
