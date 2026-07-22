import type { WalletStatus } from '@/prisma/generated/enums'
import { Badge } from '@/src/components/ui/badge'
import { Progress } from '@/src/components/ui/progress'
import { cn } from '@/src/lib/utils'
import { Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { getBadgeVariant, getBalanceVariant, getWalletLabel, type WalletLabelInput } from '../utils'

export type WalletCardData = WalletLabelInput & {
  status: WalletStatus
  lessonsBalance: number
  totalLessons: number
  totalPayments: number
}

interface WalletCardProps {
  wallet: WalletCardData
  /** Кнопки действий в шапке (рядом с бейджем баланса). Только для активных кошельков. */
  actions?: ReactNode
  /** Доп. содержимое под метриками (например, список групп). Только для активных кошельков. */
  children?: ReactNode
  className?: string
}

/**
 * Единая карточка кошелька для карточки ученика (админка) и личного кабинета родителя.
 * Архивные кошельки рендерятся в минимальном виде, без прогресса, метрик и действий.
 */
export function WalletCard({ wallet, actions, children, className }: WalletCardProps) {
  const variant = getBalanceVariant(wallet.lessonsBalance)

  if (wallet.status === 'ARCHIVED') {
    return (
      <div
        className={cn(
          'bg-muted/30 flex items-center justify-between gap-2 rounded-lg p-3 opacity-70',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs leading-tight font-medium">
          <Wallet className="text-muted-foreground size-4 shrink-0" />
          {getWalletLabel(wallet)}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline">Архив</Badge>
          <Badge variant={getBadgeVariant(variant)}>{wallet.lessonsBalance} ур.</Badge>
        </div>
      </div>
    )
  }

  const progressValue =
    wallet.totalLessons > 0
      ? (wallet.lessonsBalance / wallet.totalLessons) * 100
      : wallet.lessonsBalance > 0
        ? 100
        : 0

  return (
    <div className={cn('bg-muted/50 space-y-2.5 rounded-lg p-3', className)}>
      {/* Шапка: иконка + подпись + бейдж баланса + действия */}
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs leading-tight font-medium">
          <Wallet className="text-muted-foreground size-4 shrink-0" />
          {getWalletLabel(wallet)}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={getBadgeVariant(variant)}>{wallet.lessonsBalance} ур.</Badge>
          {actions}
        </div>
      </div>

      <Progress value={progressValue} variant={variant} />

      {/* Метрики */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Оплаты:{' '}
          <span className="text-foreground font-medium">
            {wallet.totalPayments.toLocaleString('ru-RU')} ₽
          </span>
        </span>
        <span className="text-muted-foreground">
          Уроки: <span className="text-foreground font-medium">{wallet.totalLessons}</span>
        </span>
      </div>

      {children}
    </div>
  )
}
