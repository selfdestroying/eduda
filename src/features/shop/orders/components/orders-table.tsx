'use client'

import { OrderStatus } from '@/prisma/generated/enums'
import DataTable from '@/src/components/data-table'
import TableFilter, { TableFilterItem } from '@/src/components/table-filter'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatDateTimeInTz } from '@/src/lib/timezone'
import { getFullName } from '@/src/lib/utils'
import {
  ColumnDef,
  ColumnFiltersState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cva } from 'class-variance-authority'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useOrderListQuery } from '../queries'
import { OrderWithProductAndStudent } from '../types'
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

const filterOptions: TableFilterItem[] = [
  { label: 'Выполнен', value: 'COMPLETED' },
  { label: 'В ожидании', value: 'PENDING' },
  { label: 'Отменен', value: 'CANCELLED' },
]

export default function OrdersTable() {
  const { data: orders = [], isLoading, isError } = useOrderListQuery()
  const tz = useOrgTimezone()

  const columns: ColumnDef<OrderWithProductAndStudent>[] = useMemo(
    () => [
      {
        header: 'Товар',
        accessorFn: (item) => item.product.name,
      },
      {
        header: 'Ученик',
        cell: ({ row }) => (
          <Link
            href={`/students/${row.original.student.id}`}
            className="text-primary hover:underline"
          >
            {getFullName(row.original.student.firstName, row.original.student.lastName)}
          </Link>
        ),
      },
      {
        header: 'Цена',
        accessorFn: (item) => item.product.price,
      },
      {
        id: 'status',
        header: 'Статус',
        cell: ({ row }) => {
          const status = row.original.status
          return <span className={statusVariants({ status })}>{OrderStatusMap[status]}</span>
        },
        filterFn: (row, id, filterValue) => {
          const status = row.original.status
          const selectedStatuses = (filterValue as string[]).map((value) => value.toLowerCase())
          return selectedStatuses.length === 0 || selectedStatuses.includes(status.toLowerCase())
        },
      },
      {
        header: 'Дата',
        accessorFn: (item) => formatDateTimeInTz(item.createdAt, tz),
      },
      {
        id: 'actions',
        cell: ({ row }) => <OrderActions order={row.original} />,
      },
    ],
    [tz],
  )

  const { pagination, setPagination, sorting, setSorting } = useTableSearchParams()

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: 'status', value: ['PENDING'] },
  ])

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      columnFilters,
      pagination,
      sorting,
    },
  })

  const handleStatusFilterChange = (selectedStatuses: TableFilterItem[]) => {
    const selectedValues = selectedStatuses.map((status) => status.value)
    setColumnFilters((prev) => {
      const otherFilters = prev.filter((filter) => filter.id !== 'status')
      if (selectedValues.length === 0) {
        return otherFilters
      }
      return [...otherFilters, { id: 'status', value: selectedValues }]
    })
  }

  const selectedStatuses = useMemo(() => {
    const filter = columnFilters.find((f) => f.id === 'status')
    if (!filter) return [filterOptions[1]!]
    const values = filter.value as string[]
    return filterOptions.filter((o) => values.includes(o.value))
  }, [columnFilters])

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
      toolbar={
        <div className="flex flex-col items-end gap-2 md:flex-row">
          <TableFilter
            label="Статус"
            items={filterOptions}
            value={selectedStatuses}
            onChange={handleStatusFilterChange}
          />
        </div>
      }
    />
  )
}
