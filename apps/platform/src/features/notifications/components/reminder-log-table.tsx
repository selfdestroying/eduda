'use client'

import PeriodFilter, { PERIOD_TITLE } from '@/src/components/period-filter'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { filterValues, useClampPage, useTableState } from '@/src/hooks/use-table-state'
import { formatDateTimeInTz } from '@/src/lib/timezone'
import { getFullName } from '@/src/lib/utils'
import { Badge } from '@repo/ui/components/badge'
import { cn } from '@repo/ui/lib/utils'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import {
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
} from '@tanstack/react-table'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MessengerIcon, MESSENGER_NAME } from './messenger-icon'
import { useReminderLogQuery } from '../queries'
import type { ReminderLogItem } from '../types'

/**
 * Что ушло, что нет и с какой ошибкой. Текст сообщения раскрывается прямо из
 * строки: он лежит в очереди снимком расписания на момент планирования, и
 * второй раз его взять уже неоткуда.
 */

const COLUMN_WIDTH = 130
const NUMERIC = 'tabular-nums'
const TABLE_FILTERS = { status: 'string', channel: 'string' } as const

const STATUS_OPTIONS = [
  { label: 'Отправлено', value: 'SENT' },
  { label: 'В очереди', value: 'PENDING' },
  { label: 'Не доставлено', value: 'FAILED' },
]

// В галочках фильтра значку места нет — `options[].label` принимает только строку.
const PROVIDER_OPTIONS = [
  { label: MESSENGER_NAME.VK, value: 'VK' },
  { label: MESSENGER_NAME.MAX, value: 'MAX' },
]

function StatusBadge({ row }: { row: ReminderLogItem }) {
  if (row.status === 'SENT') return <Badge variant="success">Отправлено</Badge>
  if (row.status === 'FAILED') return <Badge variant="destructive">Не доставлено</Badge>
  return <Badge variant="warning">В очереди</Badge>
}

function buildColumns(tz: string): ColumnDef<ReminderLogItem>[] {
  return [
    {
      id: 'expander',
      header: () => null,
      size: 40,
      enableHiding: false,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
          aria-label={row.getIsExpanded() ? 'Свернуть' : 'Подробнее'}
          aria-expanded={row.getIsExpanded()}
          className="text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ChevronDown
            className={cn('size-4 transition-transform', !row.getIsExpanded() && '-rotate-90')}
          />
        </button>
      ),
    },
    {
      id: 'parent',
      header: 'Родитель',
      accessorFn: (row) =>
        getFullName(row.parentMessenger.parent.firstName, row.parentMessenger.parent.lastName),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="truncate">
          {getFullName(
            row.original.parentMessenger.parent.firstName,
            row.original.parentMessenger.parent.lastName,
          )}
        </span>
      ),
      meta: { title: 'Родитель', flexible: true },
      enableHiding: false,
    },
    {
      id: 'status',
      header: 'Статус',
      accessorFn: (row) => row.status,
      size: COLUMN_WIDTH,
      cell: ({ row }) => <StatusBadge row={row.original} />,
      meta: { title: 'Статус', variant: 'multiSelect', options: STATUS_OPTIONS },
      enableHiding: false,
    },
    {
      id: 'channel',
      header: 'Канал',
      accessorFn: (row) => row.parentMessenger.provider,
      size: 90,
      enableSorting: false,
      cell: ({ row }) => <MessengerIcon provider={row.original.parentMessenger.provider} />,
      meta: { title: 'Канал', variant: 'multiSelect', options: PROVIDER_OPTIONS },
    },
    {
      id: 'createdAt',
      header: 'Запланировано',
      accessorFn: (row) => row.createdAt,
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatDateTimeInTz(row.original.createdAt, tz),
      meta: { title: 'Запланировано', className: NUMERIC },
    },
    {
      id: 'sentAt',
      header: 'Отправлено',
      accessorFn: (row) => row.sentAt,
      size: COLUMN_WIDTH,
      cell: ({ row }) =>
        row.original.sentAt ? (
          formatDateTimeInTz(row.original.sentAt, tz)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      meta: { title: 'Отправлено', className: NUMERIC },
    },
    {
      id: 'attempts',
      header: 'Попыток',
      accessorFn: (row) => row.attempts,
      size: 100,
      cell: ({ row }) => row.original.attempts,
      meta: { title: 'Попыток', className: NUMERIC },
    },
    {
      id: 'error',
      header: 'Ошибка',
      accessorFn: (row) => row.lastError ?? '',
      size: 220,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.lastError ? (
          <span className="text-destructive block truncate" title={row.original.lastError}>
            {row.original.lastError}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      meta: { title: 'Ошибка' },
    },
  ]
}

export default function ReminderLogTable() {
  const tz = useOrgTimezone()
  // Приставка обязательна: на странице вторая таблица, а имена `q`/`page`/`sort`
  // в адресе фиксированы — без неё поиск здесь отбирал бы и в списке родителей.
  const t = useTableState({ id: 'reminder-log', filters: TABLE_FILTERS, prefix: 'l_' })
  const { columnFilters, pagination, sorting, period } = t

  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: t.search,
      from: period.from ?? undefined,
      to: period.to ?? undefined,
      statuses: filterValues(columnFilters, 'status') as ('PENDING' | 'SENT' | 'FAILED')[],
      providers: filterValues(columnFilters, 'channel') as ('VK' | 'MAX')[],
    }),
    [pagination, sorting, t.search, period, columnFilters],
  )

  const { data, isLoading, isFetching, isError } = useReminderLogQuery(params)
  useClampPage(pagination, t.setPagination, data?.total)

  const columns = useMemo(() => buildColumns(tz), [tz])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    getRowCanExpand: () => true,
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    rowCount: data?.total ?? 0,
    onPaginationChange: t.setPagination,
    onColumnFiltersChange: t.setColumnFilters,
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: {
      pagination,
      sorting,
      columnFilters,
      columnVisibility: t.columnVisibility,
      expanded,
    },
  })

  if (isLoading)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  if (isError) return <div className="text-destructive">Ошибка при загрузке журнала.</div>

  return (
    <DataTable
      table={table}
      emptyMessage="Отправок пока не было."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      onRowClick={(row) => row.toggleExpanded()}
      rowClassName={(row) => (row.original.status === 'FAILED' ? 'bg-destructive/5' : undefined)}
      renderSubComponent={(row) => (
        <div className="flex flex-col gap-2 p-3">
          <p className="text-muted-foreground text-xs font-medium">Текст сообщения</p>
          <pre className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap">
            {row.original.text}
          </pre>
          {row.original.status === 'PENDING' && (
            <p className="text-muted-foreground text-xs">
              Следующая попытка — {formatDateTimeInTz(row.original.nextAttemptAt, tz)}
            </p>
          )}
        </div>
      )}
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Родитель, ученик, телефон..."
          onReset={t.reset}
          extraFilterTitles={period.from || period.to ? [PERIOD_TITLE] : []}
        >
          <PeriodFilter value={period} onChange={t.setPeriod} />
        </DataTableToolbar>
      }
    />
  )
}
