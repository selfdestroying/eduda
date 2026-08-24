'use client'

import type { StudentGroupHistoryEntry } from '@/src/features/students/actions'
import { useTableState } from '@/src/hooks/use-table-state'
import { formatDateOnly } from '@/src/lib/timezone'
import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/tooltip'
import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowRightLeft, Info } from 'lucide-react'
import Link from 'next/link'
import { useStudentGroupHistoryQuery } from '../../queries'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — даты, события, статуса. */
const COLUMN_WIDTH = 130

const statusLabels: Record<string, string> = {
  TRIAL: 'Пробный',
  ACTIVE: 'Активный',
  DISMISSED: 'Отчислен',
  TRANSFERRED: 'Переведён',
  COMPLETED: 'Завершён',
  ARCHIVED: 'Группа закрыта',
}

/**
 * Колонки, по которым фильтруем. Отбор клиентский, поэтому у колонки есть свой
 * `filterFn`: он сверяет значение со списком строк, приходящим из тулбара.
 */
const TABLE_FILTERS = { type: 'string' } as const

const TYPE_OPTIONS = [
  { label: 'Зачислен', value: 'joined' },
  { label: 'Отчислен', value: 'left' },
]

const columns: ColumnDef<StudentGroupHistoryEntry>[] = [
  {
    id: 'date',
    header: 'Дата',
    accessorKey: 'date',
    size: COLUMN_WIDTH,
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDateOnly(row.original.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
      </span>
    ),
    meta: { title: 'Дата', className: NUMERIC },
  },
  {
    id: 'type',
    header: 'Событие',
    accessorKey: 'type',
    size: COLUMN_WIDTH,
    cell: ({ row }) =>
      row.original.type === 'joined' ? (
        <Badge variant="default">Зачислен</Badge>
      ) : (
        <Badge variant="destructive">Отчислен</Badge>
      ),
    filterFn: (row, _id, filterValue) => {
      const selected = filterValue as string[]
      return selected.length === 0 || selected.includes(row.original.type)
    },
    meta: { title: 'Событие', variant: 'multiSelect', options: TYPE_OPTIONS },
  },
  {
    id: 'group',
    header: 'Группа',
    accessorKey: 'groupName',
    cell: ({ row }) => (
      <Link href={`/groups/${row.original.groupId}`} className="text-primary hover:underline">
        {row.original.groupName}
      </Link>
    ),
    meta: { title: 'Группа', flexible: true },
    // Строка без группы бессмысленна — прятать нечего.
    enableHiding: false,
  },
  {
    id: 'status',
    header: 'Текущий статус',
    accessorKey: 'status',
    size: COLUMN_WIDTH,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.status ? (statusLabels[row.original.status] ?? row.original.status) : '—'}
      </span>
    ),
    meta: { title: 'Текущий статус' },
  },
]

/**
 * Переходы одного ученика между группами: строк единицы, поэтому без пагинации —
 * данные уже пришли с карточкой.
 */
export default function GroupHistory({ studentId }: { studentId: number }) {
  const { data: history = [], isLoading, isError } = useStudentGroupHistoryQuery(studentId)
  const t = useTableState({ id: 'student-group-history', filters: TABLE_FILTERS, prefix: 'gh_' })

  const table = useReactTable({
    data: history,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => `${row.groupId}-${row.type}-${row.date}`,
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.groupName.toLowerCase().includes(String(filterValue).toLowerCase()),
    onColumnFiltersChange: t.setColumnFilters,
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: {
      globalFilter: t.globalFilter,
      columnFilters: t.columnFilters,
      sorting: t.sorting,
      columnVisibility: t.columnVisibility,
    },
  })

  if (isLoading) return <Skeleton className="h-32" />
  if (isError) return <div className="text-destructive">Ошибка при загрузке истории.</div>

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
      <DataTable
        table={table}
        emptyMessage="Нет записей о переходах."
        showColumnVisibility
        toolbar={
          <DataTableToolbar
            table={table}
            search={t.globalFilter}
            onSearchChange={t.setGlobalFilter}
            searchPlaceholder="Название группы..."
            onReset={t.reset}
          />
        }
      />
    </div>
  )
}
