'use client'

import { filterValues, useClampPage, useTableState } from '@/src/hooks/use-table-state'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { formatDateTimeInTz } from '@/src/lib/timezone'
import { getFullName } from '@/src/lib/utils'
import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'
import { MessengerIcon, MESSENGER_NAME } from './messenger-icon'
import { useReminderParentsQuery } from '../queries'
import type { ReminderParentItem } from '../types'

/**
 * Кто подключён и кого дожимать. Список именно родителей, а не привязок:
 * ценность здесь — увидеть тех, у кого привязки нет вовсе, а в списке привязок
 * их по определению не бывает.
 */

const COLUMN_WIDTH = 130
const TABLE_FILTERS = { channels: 'string', connection: 'string' } as const

const CONNECTION_OPTIONS = [
  { label: 'Подключены', value: 'connected' },
  { label: 'Отписались', value: 'unsubscribed' },
  { label: 'Не подключены', value: 'none' },
]

// В галочках фильтра значку места нет — `options[].label` принимает только строку.
const PROVIDER_OPTIONS = [
  { label: MESSENGER_NAME.VK, value: 'VK' },
  { label: MESSENGER_NAME.MAX, value: 'MAX' },
]

type Connection = 'connected' | 'unsubscribed' | 'none'

function connectionOf(row: ReminderParentItem): Connection {
  if (row.messengers.some((m) => !m.unsubscribedAt)) return 'connected'
  return row.messengers.length > 0 ? 'unsubscribed' : 'none'
}

/** Момент первой живой привязки: «подключился» — это она, а не последняя. */
function connectedAtOf(row: ReminderParentItem): Date | null {
  const active = row.messengers.filter((m) => !m.unsubscribedAt)
  if (active.length === 0) return null
  return active.reduce((min, m) => (m.createdAt < min ? m.createdAt : min), active[0]!.createdAt)
}

function buildColumns(tz: string): ColumnDef<ReminderParentItem>[] {
  return [
    {
      id: 'parent',
      header: 'Родитель',
      accessorFn: (row) => getFullName(row.firstName, row.lastName),
      cell: ({ row }) => (
        <span className="truncate">
          {getFullName(row.original.firstName, row.original.lastName)}
        </span>
      ),
      meta: { title: 'Родитель', flexible: true },
      enableHiding: false,
    },
    {
      id: 'students',
      header: 'Ученики',
      accessorFn: (row) =>
        row.students.map((s) => getFullName(s.student.firstName, s.student.lastName)).join(', '),
      size: 220,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1 truncate">
          {row.original.students.length === 0 && <span className="text-muted-foreground">—</span>}
          {row.original.students.map(({ student }, index) => (
            <Link
              key={student.id}
              href={`/students/${student.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline"
            >
              {getFullName(student.firstName, student.lastName)}
              {index < row.original.students.length - 1 && ','}
            </Link>
          ))}
        </div>
      ),
      meta: { title: 'Ученики' },
    },
    {
      id: 'connection',
      header: 'Статус',
      accessorFn: (row) => connectionOf(row),
      size: COLUMN_WIDTH,
      enableSorting: false,
      cell: ({ row }) => {
        const state = connectionOf(row.original)
        if (state === 'connected') return <Badge variant="success">Подключён</Badge>
        if (state === 'unsubscribed') return <Badge variant="secondary">Отписался</Badge>
        return <Badge variant="outline">Не подключён</Badge>
      },
      meta: { title: 'Статус', variant: 'multiSelect', options: CONNECTION_OPTIONS },
    },
    {
      id: 'channels',
      header: 'Каналы',
      accessorFn: (row) =>
        row.messengers
          .filter((m) => !m.unsubscribedAt)
          .map((m) => m.provider)
          .join(', '),
      size: COLUMN_WIDTH,
      enableSorting: false,
      cell: ({ row }) => {
        const active = row.original.messengers.filter((m) => !m.unsubscribedAt)
        if (active.length === 0) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex gap-1.5">
            {active.map((m) => (
              <MessengerIcon key={m.id} provider={m.provider} />
            ))}
          </div>
        )
      },
      meta: { title: 'Каналы', variant: 'multiSelect', options: PROVIDER_OPTIONS },
    },
    {
      id: 'connectedAt',
      header: 'Подключился',
      accessorFn: (row) => connectedAtOf(row),
      size: COLUMN_WIDTH,
      // Момент считается по нескольким строкам привязок — SQL по столбцу такую
      // сортировку не сделает, и порядок врал бы молча.
      enableSorting: false,
      cell: ({ row }) => {
        const at = connectedAtOf(row.original)
        return at ? formatDateTimeInTz(at, tz) : <span className="text-muted-foreground">—</span>
      },
      meta: { title: 'Подключился', className: 'tabular-nums' },
    },
    {
      id: 'phone',
      header: 'Телефон',
      accessorFn: (row) => row.phone ?? '',
      size: 150,
      cell: ({ row }) =>
        row.original.phone ? (
          <a
            href={`tel:${row.original.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline"
          >
            {row.original.phone}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      meta: { title: 'Телефон' },
    },
  ]
}

export default function ReminderParentsTable() {
  const tz = useOrgTimezone()
  const t = useTableState({ id: 'reminder-parents', filters: TABLE_FILTERS })
  const { columnFilters, pagination, sorting } = t

  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: t.search,
      providers: filterValues(columnFilters, 'channels') as ('VK' | 'MAX')[],
      connection: filterValues(columnFilters, 'connection') as Connection[],
    }),
    [pagination, sorting, t.search, columnFilters],
  )

  const { data, isLoading, isFetching, isError } = useReminderParentsQuery(params)
  useClampPage(pagination, t.setPagination, data?.total)

  const columns = useMemo(() => buildColumns(tz), [tz])

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
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
    },
  })

  if (isLoading)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  if (isError) return <div className="text-destructive">Ошибка при загрузке родителей.</div>

  return (
    <DataTable
      table={table}
      emptyMessage="Родителей не нашлось."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Родитель, ученик, телефон..."
          onReset={t.reset}
        />
      }
    />
  )
}
