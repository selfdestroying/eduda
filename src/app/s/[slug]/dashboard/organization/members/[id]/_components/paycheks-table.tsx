'use client'
import { PayCheck } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import {
  ColumnDef,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { formatDateOnly } from '@/src/lib/timezone'
import { useState } from 'react'
import PayCheckActions from './paycheck-actions'

export default function PayChecksTable({ data, userName }: { data: PayCheck[]; userName: string }) {
  const columns: ColumnDef<PayCheck>[] = [
    {
      header: 'Дата',
      accessorKey: 'date',
      cell: ({ row }) => formatDateOnly(row.original.date),
    },
    {
      header: 'Сумма',
      cell: ({ row }) => (
        <span className="font-bold">{row.original.amount.toLocaleString()} ₽</span>
      ),
    },
    {
      header: 'Комментарий',
      cell: ({ row }) => (
        <p className="max-w-52 truncate" title={row.original.comment || ''}>
          {row.original.comment}
        </p>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => <PayCheckActions paycheck={row.original} userName={userName} />,
    },
  ]
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([])
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
    },
  })

  return <DataTable table={table} emptyMessage="Нет чеков." showPagination />
}
