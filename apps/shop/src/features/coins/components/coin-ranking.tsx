import { Badge } from '@repo/ui/components/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@repo/ui/components/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'
import { cn } from '@repo/ui/lib/utils'

export interface RankingRow {
  place: number
  studentId: number
  name: string
  amount: number
}

interface CoinRankingProps {
  /** `YYYY-MM` — месяц, за который построен рейтинг. */
  month: string
  top: RankingRow[]
  /** Своя строка; null — за этот месяц ученик ещё ничего не заработал. */
  me: RankingRow | null
  studentId: number
}

/** `2026-08` → «август 2026» */
function monthLabel(month: string): string {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export function CoinRanking({ month, top, me, studentId }: CoinRankingProps) {
  // Ученик вне топа дописывается отдельной строкой, чтобы своё место было видно
  // всегда — ради него он сюда и заходит.
  const meBelowTop = me && !top.some((row) => row.studentId === studentId) ? me : null

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Рейтинг за {monthLabel(month)}</h2>
        <p className="text-muted-foreground text-xs">Считаются только заработанные коины</p>
      </div>

      {top.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>В этом месяце пока никто ничего не заработал</EmptyTitle>
            <EmptyDescription>
              Коины за посещения и достижения попадут в рейтинг сразу, как появятся.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Место</TableHead>
              <TableHead>Ученик</TableHead>
              <TableHead className="text-right">Заработано</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...top, ...(meBelowTop ? [meBelowTop] : [])].map((row) => (
              <TableRow
                key={row.studentId}
                className={cn(row.studentId === studentId && 'bg-muted/50 font-medium')}
              >
                <TableCell className="tabular-nums">{row.place}</TableCell>
                <TableCell>
                  {row.name}
                  {row.studentId === studentId && (
                    <span className="text-muted-foreground"> · это вы</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={row.place <= 3 ? 'default' : 'secondary'}>+{row.amount}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!me && top.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Вы пока не заработали коинов в этом месяце — в рейтинге вас нет.
        </p>
      )}
    </div>
  )
}
