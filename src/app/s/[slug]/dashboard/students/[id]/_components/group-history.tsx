'use client'

import type { StudentGroupHistoryEntry } from '@/src/actions/students'
import DataTable from '@/src/components/data-table'
import { Badge } from '@/src/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip'
import { ColumnDef, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { toZonedTime } from 'date-fns-tz'
import { ArrowRightLeft, Info } from 'lucide-react'
import Link from 'next/link'

const statusLabels: Record<string, string> = {
  TRIAL: 'Пробный',
  ACTIVE: 'Активный',
  DISMISSED: 'Отчислен',
}

function formatDate(date: Date) {
  const d = toZonedTime(date, 'Europe/Moscow')
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const columns: ColumnDef<StudentGroupHistoryEntry>[] = [
  {
    header: 'Дата',
    accessorFn: (row) => row.date,
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span>,
  },
  {
    header: 'Событие',
    accessorFn: (row) => row.type,
    cell: ({ row }) =>
      row.original.type === 'joined' ? (
        <Badge variant="default">Зачислен</Badge>
      ) : (
        <Badge variant="destructive">Отчислен</Badge>
      ),
  },
  {
    header: 'Группа',
    accessorFn: (row) => row.groupName,
    cell: ({ row }) => (
      <Link
        href={`/dashboard/groups/${row.original.groupId}`}
        className="text-primary hover:underline"
      >
        {row.original.groupName}
      </Link>
    ),
  },
  {
    header: 'Текущий статус',
    accessorFn: (row) => row.status,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.status ? (statusLabels[row.original.status] ?? row.original.status) : '-'}
      </span>
    ),
  },
]

export default function GroupHistory({ history }: { history: StudentGroupHistoryEntry[] }) {
  const table = useReactTable({
    data: history,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground flex items-center gap-2 text-lg font-semibold">
        <ArrowRightLeft size={20} />
        История переходов между группами
        <Tooltip>
          <TooltipTrigger className="text-warning hover:text-warning cursor-help">
            <Info size={16} />
          </TooltipTrigger>
          <TooltipContent>
            Раздел в режиме тестирования. Даты зачислений и отчислений вычисляются приблизительно на
            основе первого и последнего посещённого урока в группе и могут отображаться некорректно.
          </TooltipContent>
        </Tooltip>
      </h3>
      <DataTable table={table} emptyMessage="Нет записей о переходах." />
    </div>
  )
}
