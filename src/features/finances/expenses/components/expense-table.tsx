'use client'

import { Expense } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatDateOnly } from '@/src/lib/timezone'
import {
  type ColumnDef,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { useExpenseListQuery } from '../queries'
import ExpenseActions from './expense-actions'

export default function ExpenseTable() {
  const { data: expenses = [], isLoading, isError } = useExpenseListQuery()

  const columns: ColumnDef<Expense>[] = useMemo(
    () => [
      {
        header: 'Название',
        accessorKey: 'name',
      },
      {
        header: 'Сумма',
        accessorKey: 'amount',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.amount.toLocaleString('ru-RU')} ₽</span>
        ),
      },
      {
        header: 'Дата',
        accessorKey: 'date',
        cell: ({ row }) => formatDateOnly(row.original.date),
      },
      {
        header: 'Комментарий',
        accessorKey: 'comment',
        cell: ({ row }) => row.original.comment || '-',
      },
      {
        id: 'actions',
        cell: ({ row }) => <ExpenseActions expense={row.original} />,
      },
    ],
    [],
  )

  const { globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting } =
    useTableSearchParams()

  const table = useReactTable({
    data: expenses,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      return (
        row.original.name.toLowerCase().includes(searchValue) ||
        (row.original.comment?.toLowerCase().includes(searchValue) ?? false)
      )
    },
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { globalFilter, pagination, sorting },
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
    <DataTable
      table={table}
      emptyMessage="Нет расходов."
      showPagination
      toolbar={
        <div className="flex flex-col items-end gap-2 md:flex-row">
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Поиск..."
          />
        </div>
      }
    />
  )
}
