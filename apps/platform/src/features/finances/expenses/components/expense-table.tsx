'use client'

import PeriodFilter, { PERIOD_TITLE } from '@/src/components/period-filter'
import { rangeValues, useClampPage, useTableState } from '@/src/hooks/use-table-state'
import { formatDateOnly } from '@/src/lib/timezone'
import { formatCurrency } from '@/src/lib/utils'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useExpenseListQuery } from '../queries'
import type { ExpenseListItem } from '../types'
import ExpenseActions from './expense-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — сумм и дат. */
const COLUMN_WIDTH = 130

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Колонки, по которым фильтруем: `useTableState` держит их в URL, а отсюда они
 * уезжают в запрос.
 */
const TABLE_FILTERS = { amount: 'range' } as const

const columns: ColumnDef<ExpenseListItem>[] = [
  {
    id: 'name',
    header: 'Название',
    accessorKey: 'name',
    meta: { title: 'Название', flexible: true },
    // Строка без названия бессмысленна — прятать нечего.
    enableHiding: false,
  },
  {
    // Деньги раньше даты: на странице расходов сумма — главная цифра.
    id: 'amount',
    header: 'Сумма',
    accessorKey: 'amount',
    size: COLUMN_WIDTH,
    cell: ({ row }) => formatCurrency(row.original.amount),
    meta: { title: 'Сумма', className: NUMERIC, variant: 'range', unit: '₽' },
  },
  {
    id: 'date',
    header: 'Дата',
    accessorKey: 'date',
    size: COLUMN_WIDTH,
    cell: ({ row }) => formatDateOnly(row.original.date),
    meta: { title: 'Дата', className: NUMERIC },
  },
  {
    id: 'comment',
    header: 'Комментарий',
    accessorKey: 'comment',
    cell: ({ row }) => row.original.comment || '—',
    enableSorting: false,
    meta: { title: 'Комментарий', flexible: true },
  },
  {
    id: 'actions',
    header: () => null,
    size: ACTIONS_WIDTH,
    enableHiding: false,
    cell: ({ row }) => <ExpenseActions expense={row.original} />,
  },
]

export default function ExpenseTable() {
  const t = useTableState({ id: 'expenses', filters: TABLE_FILTERS })
  const { columnFilters, pagination, sorting, period } = t

  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: t.search,
      from: period.from ?? undefined,
      to: period.to ?? undefined,
      amountMin: rangeValues(columnFilters, 'amount')[0] ?? null,
      amountMax: rangeValues(columnFilters, 'amount')[1] ?? null,
    }),
    [pagination, sorting, t.search, period, columnFilters],
  )

  const { data, isLoading, isFetching, isError } = useExpenseListQuery(params)
  useClampPage(pagination, t.setPagination, data?.total)

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Ключ строки — id расхода, а не её место на странице.
    getRowId: (row) => String(row.id),
    // Отбор, порядок и нарезка — в SQL.
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    // Иначе пагинации не из чего считать число страниц: она видит только текущую.
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError) {
    return <div className="text-destructive">Ошибка при загрузке расходов.</div>
  }

  return (
    <div className="flex flex-col gap-2">
      <DataTable
        table={table}
        emptyMessage="Нет расходов."
        showPagination
        showColumnVisibility
        isRefreshing={isFetching}
        toolbar={
          <DataTableToolbar
            table={table}
            search={t.globalFilter}
            onSearchChange={t.setGlobalFilter}
            searchPlaceholder="Название, комментарий..."
            onReset={t.reset}
            extraFilterTitles={period.from || period.to ? [PERIOD_TITLE] : []}
          >
            <PeriodFilter value={period} onChange={t.setPeriod} />
          </DataTableToolbar>
        }
      />
      {/* Итог по всему отбору, а не по видимой странице: считает его сервер тем же
          `where`, иначе цифра меняла бы смысл при каждом перелистывании. */}
      <div className="text-muted-foreground text-sm">
        Итого по отбору:{' '}
        <span className="text-foreground font-medium tabular-nums">
          {formatCurrency(data?.amountTotal ?? 0)}
        </span>
      </div>
    </div>
  )
}
