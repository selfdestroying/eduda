'use client'

import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { filterValues, useClampPage, useTableState } from '@/src/hooks/use-table-state'
import { formatDateTimeInTz } from '@/src/lib/timezone'
import { getFullName } from '@/src/lib/utils'
import { OrderStatus } from '@repo/db/enums'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { cva } from 'class-variance-authority'
import Link from 'next/link'
import { useMemo } from 'react'
import { useOrderListQuery } from '../queries'
import type { OrderListSchemaType } from '../schemas'
import { type OrderListItem, orderTotal } from '../types'
import OrderActions from './order-actions'

export const OrderStatusMap: { [key in OrderStatus]: string } = {
  CANCELLED: 'Отменен',
  COMPLETED: 'Выполнен',
  PENDING: 'В ожидании',
}

const statusVariants = cva('', {
  variants: {
    status: {
      PENDING: 'text-warning',
      COMPLETED: 'text-success',
      CANCELLED: 'text-destructive',
    },
  },
})

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — сумм, дат, статуса. */
const COLUMN_WIDTH = 130

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Колонки, по которым фильтруем: `useTableState` держит их в URL, а отсюда они
 * уезжают в запрос.
 */
const TABLE_FILTERS = { status: 'string' } as const

const STATUS_OPTIONS = [
  { label: OrderStatusMap.PENDING, value: 'PENDING' },
  { label: OrderStatusMap.COMPLETED, value: 'COMPLETED' },
  { label: OrderStatusMap.CANCELLED, value: 'CANCELLED' },
]

function buildColumns(tz: string): ColumnDef<OrderListItem>[] {
  return [
    {
      id: 'items',
      header: 'Товары',
      // Заказ бывает из нескольких позиций: в строке — первый товар и счётчик
      // остальных, полный состав виден в диалоге смены статуса.
      accessorFn: (row) => row.items[0]?.shopItem.name ?? '',
      cell: ({ row }) => {
        const items = row.original.items
        if (items.length === 0) return '—'
        const first = items[0]!
        return (
          <span className="flex items-center gap-1.5">
            <span className="truncate">{first.shopItem.name}</span>
            {first.quantity > 1 && (
              <span className="text-muted-foreground text-xs">×{first.quantity}</span>
            )}
            {items.length > 1 && (
              <span className="text-muted-foreground text-xs">+{items.length - 1}</span>
            )}
          </span>
        )
      },
      // Сортировать по «первому товару в заказе» нечего: порядок позиций внутри
      // заказа ничего не значит.
      enableSorting: false,
      meta: { title: 'Товары', flexible: true },
      // Строка без товаров бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'student',
      header: 'Ученик',
      accessorFn: (row) => getFullName(row.student.firstName, row.student.lastName),
      cell: ({ row }) => (
        <Link
          href={`/students/${row.original.student.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-primary hover:underline"
        >
          {getFullName(row.original.student.firstName, row.original.student.lastName)}
        </Link>
      ),
      meta: { title: 'Ученик', flexible: true },
    },
    {
      id: 'total',
      header: 'Сумма',
      accessorFn: (row) => orderTotal(row),
      size: COLUMN_WIDTH,
      // Сумма складывается из снимков цен в позициях — SQL такую не отсортирует.
      enableSorting: false,
      meta: { title: 'Сумма', className: NUMERIC },
    },
    {
      id: 'status',
      header: 'Статус',
      accessorKey: 'status',
      size: COLUMN_WIDTH,
      cell: ({ row }) => (
        <span className={statusVariants({ status: row.original.status })}>
          {OrderStatusMap[row.original.status]}
        </span>
      ),
      meta: { title: 'Статус', variant: 'multiSelect', options: STATUS_OPTIONS },
    },
    {
      id: 'createdAt',
      header: 'Дата',
      accessorKey: 'createdAt',
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatDateTimeInTz(row.original.createdAt, tz),
      meta: { title: 'Дата', className: NUMERIC },
    },
    {
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => <OrderActions order={row.original} />,
    },
  ]
}

export default function OrdersTable() {
  const t = useTableState({ id: 'orders', filters: TABLE_FILTERS })
  const { columnFilters, pagination, sorting } = t
  const tz = useOrgTimezone()

  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: t.search,
      statuses: filterValues(columnFilters, 'status') as OrderListSchemaType['statuses'],
    }),
    [pagination, sorting, t.search, columnFilters],
  )

  const { data, isLoading, isFetching, isError } = useOrderListQuery(params)
  useClampPage(pagination, t.setPagination, data?.total)

  const columns = useMemo(() => buildColumns(tz), [tz])

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Ключ строки — id заказа, а не её место на странице.
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
    return <div className="text-destructive">Ошибка при загрузке заказов.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет заказов."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      // Отменённый заказ остаётся в списке следом операции, но читаться должен как
      // погашенный.
      rowClassName={(row) => (row.original.status === 'CANCELLED' ? 'opacity-55' : undefined)}
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Ученик или товар..."
          onReset={t.reset}
        />
      }
    />
  )
}
