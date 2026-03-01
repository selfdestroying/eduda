'use client'
import { OrderStatus } from '@/prisma/generated/enums'
import { OrderWithProductAndStudent } from '@/src/actions/orders'
import DataTable from '@/src/components/data-table'
import TableFilter, { TableFilterItem } from '@/src/components/table-filter'
import { toMoscow } from '@/src/lib/timezone'
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
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { cva } from 'class-variance-authority'
import Link from 'next/link'
import { useState } from 'react'
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

const columns: ColumnDef<OrderWithProductAndStudent>[] = [
  {
    header: 'Товар',
    accessorFn: (item) => item.product.name,
  },
  {
    header: 'Ученик',
    cell: ({ row }) => (
      <Link
        href={`/dashboard/students/${row.original.student.id}`}
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
    accessorFn: (item) => toMoscow(item.createdAt).toLocaleString('ru-RU'),
  },
  {
    id: 'actions',
    cell: ({ row }) => <OrderActions order={row.original} />,
  },
]

const filterOptions: TableFilterItem[] = [
  { label: 'Выполнен', value: 'COMPLETED' },
  { label: 'В ожидании', value: 'PENDING' },
  { label: 'Отменен', value: 'CANCELLED' },
]

export default function OrdersTable({ data }: { data: OrderWithProductAndStudent[] }) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [filterValues, setFilterValues] = useState<TableFilterItem[]>([filterOptions[1]!])
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: 'status', value: ['PENDING'] },
  ])
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      pagination,
      sorting,
      columnFilters,
    },
  })

  const handleStatusFilterChange = (selectedStatuses: TableFilterItem[]) => {
    setFilterValues(selectedStatuses)
    const selectedValues = selectedStatuses.map((status) => status.value)
    setColumnFilters((prev) => {
      const otherFilters = prev.filter((filter) => filter.id !== 'status')
      if (selectedValues.length === 0) {
        return otherFilters
      }
      return [...otherFilters, { id: 'status', value: selectedValues }]
    })
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
            value={filterValues}
            onChange={handleStatusFilterChange}
          />
        </div>
      }
    />
  )
}
