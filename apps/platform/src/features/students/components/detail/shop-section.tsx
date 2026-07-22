'use client'

import type { OrderStatus } from '@/prisma/generated/enums'
import { StatCard } from '@/src/components/stat-card'
import { Badge } from '@/src/components/ui/badge'
import { Skeleton } from '@/src/components/ui/skeleton'
import { OrderStatusMap } from '@/src/features/shop/orders/components/orders-table'
import { cn } from '@/src/lib/utils'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  CheckCircle2,
  Clock,
  Coins,
  Package,
  ShoppingBag,
  ShoppingCart,
  XCircle,
} from 'lucide-react'
import { useStudentShopStatsQuery } from '../../queries'
import AddCoinsForm from './add-coins-form'

interface ShopSectionProps {
  studentId: number
  coins: number
}

const statusBadgeVariants: Record<OrderStatus, string> = {
  PENDING:
    'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-transparent',
  COMPLETED:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-transparent',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-transparent',
}

const statusIcons: Record<OrderStatus, React.ComponentType<{ className?: string }>> = {
  PENDING: Clock,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
}

export default function ShopSection({ coins, studentId }: ShopSectionProps) {
  const { data: stats, isLoading } = useStudentShopStatsQuery(studentId)

  // Prefer fresh value from stats query; fall back to prop while loading.
  const currentCoins = stats?.coins ?? coins
  const totalSpent = stats?.totalSpent ?? 0
  const totalOrders = stats?.totalOrders ?? 0
  const pendingOrders = stats?.pendingOrders ?? 0
  const completedOrders = stats?.completedOrders ?? 0
  const recentOrders = stats?.recentOrders ?? []

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <ShoppingCart size={20} />
        Магазин
      </h3>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Баланс"
          value={
            <span className="flex items-center gap-1.5">
              {currentCoins}
              <Coins className="size-4 text-violet-500" />
            </span>
          }
          icon={Coins}
          variant={currentCoins > 0 ? 'success' : 'default'}
          hint="Внутренняя валюта, которую ученик зарабатывает за активность на уроках и тратит в магазине наград."
        />
        <StatCard
          label="Всего потрачено"
          value={
            <span className="flex items-center gap-1.5">
              {totalSpent}
              <Coins className="text-muted-foreground size-4" />
            </span>
          }
          icon={ShoppingBag}
          description={`за ${completedOrders} ${pluralize(completedOrders, ['заказ', 'заказа', 'заказов'])}`}
        />
        <StatCard label="Заказов всего" value={totalOrders} icon={Package} />
        <StatCard
          label="В ожидании"
          value={pendingOrders}
          icon={Clock}
          variant={pendingOrders > 0 ? 'warning' : 'default'}
          description={pendingOrders > 0 ? 'требуют обработки' : 'всё обработано'}
        />
      </div>

      <AddCoinsForm studentId={studentId} currentCoins={currentCoins} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-muted-foreground text-sm font-medium">Последние заказы</h4>
          {totalOrders > recentOrders.length ? (
            <span className="text-muted-foreground text-xs">
              показано {recentOrders.length} из {totalOrders}
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="bg-muted/30 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm">
            <ShoppingBag className="size-8 opacity-50" />
            <span>Заказов пока нет</span>
          </div>
        ) : (
          <ul className="divide-border bg-card divide-y rounded-lg border">
            {recentOrders.map((order) => {
              const Icon = statusIcons[order.status]
              const total = order.product.price * order.quantity
              return (
                <li key={order.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{order.product.name}</span>
                      {order.quantity > 1 ? (
                        <span className="text-muted-foreground text-xs">×{order.quantity}</span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {format(order.createdAt, 'd MMM yyyy, HH:mm', { locale: ru })}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      className={cn('gap-1', statusBadgeVariants[order.status])}
                      variant="outline"
                    >
                      <Icon className="size-3" />
                      {OrderStatusMap[order.status]}
                    </Badge>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-sm font-semibold tabular-nums',
                        order.status === 'CANCELLED' && 'text-muted-foreground line-through',
                      )}
                    >
                      {total}
                      <Coins className="size-3.5 text-violet-500" />
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function pluralize(n: number, forms: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}
