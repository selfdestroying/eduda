'use client'

import { useTableState } from '@/src/hooks/use-table-state'
import { PaymentMethod } from '@repo/db'
import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { usePaymentMethodListQuery } from '../queries'
import PaymentMethodActions from './payment-method-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — процента и статуса. */
const COLUMN_WIDTH = 130

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Колонки, по которым фильтруем. Отбор клиентский, поэтому у колонки есть свой
 * `filterFn`: он сверяет значение со списком строк, приходящим из тулбара.
 */
const TABLE_FILTERS = { isActive: 'string' } as const

const STATUS_OPTIONS = [
  { label: 'Активен', value: 'true' },
  { label: 'Неактивен', value: 'false' },
]

const columns: ColumnDef<PaymentMethod>[] = [
  {
    id: 'name',
    header: 'Название',
    accessorKey: 'name',
    meta: { title: 'Название', flexible: true },
    // Строка без названия бессмысленна — прятать нечего.
    enableHiding: false,
  },
  {
    id: 'commission',
    header: 'Комиссия',
    accessorKey: 'commission',
    size: COLUMN_WIDTH,
    cell: ({ row }) => `${row.original.commission}%`,
    meta: { title: 'Комиссия', className: NUMERIC },
  },
  {
    id: 'description',
    header: 'Описание',
    accessorKey: 'description',
    cell: ({ row }) => row.original.description || '—',
    enableSorting: false,
    meta: { title: 'Описание', flexible: true },
  },
  {
    id: 'isActive',
    header: 'Статус',
    accessorKey: 'isActive',
    size: COLUMN_WIDTH,
    cell: ({ row }) =>
      row.original.isActive ? <Badge>Активен</Badge> : <Badge variant="secondary">Неактивен</Badge>,
    // Значения фильтра — строки: они едут в URL и обратно приходят строками.
    filterFn: (row, _id, filterValue) => {
      const selected = filterValue as string[]
      return selected.length === 0 || selected.includes(String(row.original.isActive))
    },
    meta: { title: 'Статус', variant: 'multiSelect', options: STATUS_OPTIONS },
  },
  {
    id: 'actions',
    header: () => null,
    size: ACTIONS_WIDTH,
    enableHiding: false,
    cell: ({ row }) => <PaymentMethodActions paymentMethod={row.original} />,
  },
]

/**
 * Справочник методов оплаты: их единицы, и отбор с нарезкой остаются на клиенте.
 */
export default function PaymentMethodsTable() {
  const { data: methods = [], isLoading, isError } = usePaymentMethodListQuery()
  const t = useTableState({ id: 'payment-methods', filters: TABLE_FILTERS })

  const table = useReactTable({
    data: methods,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.name.toLowerCase().includes(String(filterValue).toLowerCase()),
    onPaginationChange: t.setPagination,
    onColumnFiltersChange: t.setColumnFilters,
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: {
      globalFilter: t.globalFilter,
      columnFilters: t.columnFilters,
      pagination: t.pagination,
      sorting: t.sorting,
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
    return <div className="text-destructive">Ошибка при загрузке методов оплаты.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет методов оплаты."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Название метода..."
          onReset={t.reset}
        />
      }
    />
  )
}
