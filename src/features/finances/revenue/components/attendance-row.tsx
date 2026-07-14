import { Badge } from '@/src/components/ui/badge'
import { TableCell, TableRow } from '@/src/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import { ymdToLocalDate } from '@/src/lib/timezone'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import type { AttendanceWithCost } from '../types'

const ATTENDANCE_CONFIG = {
  PRESENT: {
    label: 'Присутствовал',
    class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  ABSENT: { label: 'Отсутствовал', class: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  UNSPECIFIED: { label: 'Не указан', class: 'bg-muted text-muted-foreground' },
} as const

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: string) {
  return format(ymdToLocalDate(date), 'd MMMM', { locale: ru })
}

interface AttendanceRowProps {
  attendance: AttendanceWithCost
}

export default function AttendanceRow({ attendance: att }: AttendanceRowProps) {
  const attConfig =
    ATTENDANCE_CONFIG[att.status as keyof typeof ATTENDANCE_CONFIG] ?? ATTENDANCE_CONFIG.UNSPECIFIED

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <Link href={`/students/${att.student.id}`} className="text-primary hover:underline">
            {att.student.lastName} {att.student.firstName}
          </Link>

          {att.makeupAttendance?.lesson && (
            <Badge
              variant="outline"
              className="border-violet-200 bg-violet-500/10 text-[0.5625rem] text-violet-600 dark:border-violet-800 dark:text-violet-400"
            >
              {att.makeupAttendance.status === 'PRESENT' ? (
                <>
                  <CheckCircle2 />
                  Отработал{' '}
                </>
              ) : (
                <>
                  <XCircle />
                  Не отработал{' '}
                </>
              )}
              {formatDate(att.makeupAttendance.lesson.date)}
            </Badge>
          )}
          {att.isWarned && (
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="size-3.5 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>Предупредил</TooltipContent>
            </Tooltip>
          )}
          {att.isTrial && (
            <Badge variant="secondary" className="text-[0.5625rem]">
              Пробный
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-medium ${attConfig.class}`}
        >
          {attConfig.label}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {att.visitCost > 0 ? (
          <Tooltip>
            <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4">
              {formatCurrency(att.visitCost)}
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              <p className="text-xs whitespace-pre-line">{att.costReason}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger className="text-muted-foreground cursor-help">-</TooltipTrigger>
            <TooltipContent className="max-w-64">
              <p className="text-xs">{att.costReason}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  )
}
