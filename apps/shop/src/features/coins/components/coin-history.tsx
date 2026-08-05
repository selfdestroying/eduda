import { formatDateTimeInTz } from '@/src/lib/date'
import { CoinTxReason } from '@repo/db/enums'
import { Badge } from '@repo/ui/components/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@repo/ui/components/empty'
import { Separator } from '@repo/ui/components/separator'
import { StatCard } from '@repo/ui/components/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'
import { Coins } from 'lucide-react'

const REASON_LABEL: Record<CoinTxReason, string> = {
  ATTENDANCE_PRESENT: 'Посещение',
  ATTENDANCE_REVERTED: 'Отмена посещения',
  MANUAL_GRANT: 'Начисление',
  MANUAL_DEDUCT: 'Списание',
  ORDER_PURCHASE: 'Покупка',
  ORDER_CANCELLED: 'Возврат за заказ',
  INITIAL_BALANCE: 'Начальный баланс',
  ACHIEVEMENT_CLAIM: 'Достижение',
}

export interface CoinRow {
  id: number
  amount: number
  reason: CoinTxReason
  createdAt: Date
  orderId: number | null
}

interface CoinHistoryProps {
  balance: number
  items: CoinRow[]
  tz: string
}

export function CoinHistory({ balance, items, tz }: CoinHistoryProps) {
  return (
    <div className="space-y-6">
      <StatCard label="Баланс" value={balance} icon={Coins} />

      <Separator />

      {items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>История пуста</EmptyTitle>
            <EmptyDescription>
              Коины начисляются за посещения занятий и вручную — школой.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Когда</TableHead>
              <TableHead>Причина</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTimeInTz(item.createdAt, tz, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  {REASON_LABEL[item.reason]}
                  {item.orderId !== null && (
                    <span className="text-muted-foreground"> · заказ №{item.orderId}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={item.amount >= 0 ? 'default' : 'secondary'}>
                    {item.amount >= 0 ? `+${item.amount}` : item.amount}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
