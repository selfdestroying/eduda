'use client'

import { PayCheck } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { Skeleton } from '@/src/components/ui/skeleton'
import { formatDateOnly } from '@/src/lib/timezone'
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
import { useState } from 'react'
import { usePaycheckListQuery } from '../queries'
import PayCheckActions from './paycheck-actions'

interface PayChecksTableProps {
  userId: number
  userName: string
}

export default function PayChecksTable({ userId, userName }: PayChecksTableProps) {
  const { data: paychecks = [], isLoading, isError } = usePaycheckListQuery(userId)

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
      cell: ({ row }) => (
        <PayCheckActions paycheck={row.original} userName={userName} userId={userId} />
      ),
    },
  ]

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data: paychecks,
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

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (isError) return <div className="text-destructive">Ошибка загрузки</div>

  return <DataTable table={table} emptyMessage="Нет чеков." showPagination />
}
