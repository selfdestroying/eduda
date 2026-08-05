import { formatDateOnly } from '@/src/lib/date'
import { AttendanceStatus } from '@repo/db/enums'
import { Badge } from '@repo/ui/components/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@repo/ui/components/empty'
import { Progress } from '@repo/ui/components/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Был',
  ABSENT: 'Не был',
  UNSPECIFIED: 'Не отмечен',
}

const STATUS_VARIANT: Record<AttendanceStatus, 'default' | 'secondary' | 'outline'> = {
  PRESENT: 'default',
  ABSENT: 'secondary',
  UNSPECIFIED: 'outline',
}

export interface AttendanceRow {
  lessonId: number
  date: string
  time: string
  group: string
  course: string
  status: AttendanceStatus
}

export function AttendanceTable({ rows, limit }: { rows: AttendanceRow[]; limit: number }) {
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Занятий пока не было</EmptyTitle>
          <EmptyDescription>Здесь появятся уроки, на которых вас отметили.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // Процент считаем только по отмеченным урокам: неотмеченный — это ещё не пропуск.
  const marked = rows.filter((r) => r.status !== 'UNSPECIFIED')
  const present = marked.filter((r) => r.status === 'PRESENT').length
  const rate = marked.length > 0 ? Math.round((present / marked.length) * 100) : null
  // Список обрезан лимитом, значит процент описывает не всю историю, а окно.
  // Подписываем честно, иначе цифра выдаёт себя за общую посещаемость.
  const truncated = rows.length >= limit

  return (
    <div className="space-y-4">
      {rate !== null && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {truncated ? `Посещаемость за последние ${rows.length} занятий` : 'Посещаемость'}
            </span>
            <span className="font-semibold">
              {rate}% · {present} из {marked.length}
            </span>
          </div>
          <Progress value={rate} />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Группа</TableHead>
            <TableHead className="text-right">Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.lessonId}>
              <TableCell className="whitespace-nowrap">
                {formatDateOnly(row.date)}
                <span className="text-muted-foreground ml-1.5">{row.time}</span>
              </TableCell>
              <TableCell>
                <div>{row.group}</div>
                <div className="text-muted-foreground text-xs">{row.course}</div>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
