import { Badge } from '@/src/components/ui/badge'
import { Progress } from '@/src/components/ui/progress'
import { StatCard } from '@/src/components/ui/stat-card'
import { getGroupName } from '@/src/lib/utils'
import { StudentWithGroupsAndAttendance } from '@/src/types/student'
import { BookOpen, Calculator, ReceiptRussianRuble, TrendingDown, Wallet } from 'lucide-react'

type BalanceVariant = 'success' | 'warning' | 'danger'

function getBalanceVariant(balance: number): BalanceVariant {
  if (balance < 2) return 'danger'
  if (balance < 5) return 'warning'
  return 'success'
}

function getBalanceLabel(variant: BalanceVariant): string {
  switch (variant) {
    case 'danger':
      return 'Критический'
    case 'warning':
      return 'Низкий'
    case 'success':
      return 'Норма'
  }
}

function getBadgeVariant(variant: BalanceVariant) {
  switch (variant) {
    case 'danger':
      return 'destructive' as const
    case 'warning':
      return 'outline' as const
    case 'success':
      return 'secondary' as const
  }
}

interface PaymentSectionProps {
  student: StudentWithGroupsAndAttendance
}

export default function PaymentSection({ student }: PaymentSectionProps) {
  const groupBalances = student.groups.map((sg) => ({
    groupId: sg.groupId,
    groupName: getGroupName(sg.group),
    lessonsBalance: sg.lessonsBalance,
    totalLessons: sg.totalLessons,
    totalPayments: sg.totalPayments,
  }))

  const totalPaymentsAggregate =
    groupBalances.reduce((sum, g) => sum + g.totalPayments, 0) + student.totalPayments
  const totalLessonsAggregate =
    groupBalances.reduce((sum, g) => sum + g.totalLessons, 0) + student.totalLessons
  const allocatedLessonsBalance = groupBalances.reduce((sum, g) => sum + g.lessonsBalance, 0)
  const unallocatedBalance = student.lessonsBalance
  const totalLessonsBalance = allocatedLessonsBalance + unallocatedBalance

  const avgCost =
    totalLessonsAggregate > 0 ? (totalPaymentsAggregate / totalLessonsAggregate).toFixed(0) : '—'

  const balanceVariant = getBalanceVariant(totalLessonsBalance)

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <ReceiptRussianRuble size={20} />
        Финансы
      </h3>
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Сумма оплат"
          value={`${totalPaymentsAggregate.toLocaleString('ru-RU')} ₽`}
          icon={ReceiptRussianRuble}
        />
        <StatCard label="Всего уроков" value={totalLessonsAggregate} icon={BookOpen} />
        <StatCard
          label="Средняя стоимость"
          value={avgCost === '—' ? avgCost : `${Number(avgCost).toLocaleString('ru-RU')} ₽`}
          description={avgCost !== '—' ? 'за урок' : undefined}
          icon={Calculator}
        />
        <StatCard
          label="Баланс уроков"
          value={`${totalLessonsBalance} ур.`}
          description={getBalanceLabel(balanceVariant)}
          variant={balanceVariant}
          icon={Wallet}
        />
      </div>

      {/* Unallocated balance warning */}
      {unallocatedBalance > 0 && (
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
          <TrendingDown className="text-muted-foreground size-3.5 shrink-0" />
          <span className="text-muted-foreground">
            Нераспределённый остаток:{' '}
            <span className="text-foreground font-medium">{unallocatedBalance} ур.</span>
            {' — '}не привязан ни к одной группе
          </span>
        </div>
      )}

      {/* Per-group breakdown */}
      {groupBalances.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-xs font-medium">Детализация по группам</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {groupBalances.map((gb) => {
              const variant = getBalanceVariant(gb.lessonsBalance)
              const progressValue =
                gb.totalLessons > 0
                  ? (gb.lessonsBalance / gb.totalLessons) * 100
                  : gb.lessonsBalance > 0
                    ? 100
                    : 0

              return (
                <div key={gb.groupId} className="bg-muted/50 space-y-2.5 rounded-lg p-3">
                  {/* Group name + balance badge */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs leading-tight font-medium">{gb.groupName}</span>
                    <Badge variant={getBadgeVariant(variant)}>{gb.lessonsBalance} ур.</Badge>
                  </div>

                  {/* Progress bar */}
                  <Progress value={progressValue} variant={variant} />

                  {/* Metrics row */}
                  <div className="flex items-center justify-between text-[0.6875rem]">
                    <span className="text-muted-foreground">
                      Оплаты:{' '}
                      <span className="text-foreground font-medium">
                        {gb.totalPayments.toLocaleString('ru-RU')} ₽
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Уроки: <span className="text-foreground font-medium">{gb.totalLessons}</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
