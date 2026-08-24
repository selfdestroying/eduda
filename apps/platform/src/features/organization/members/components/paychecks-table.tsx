'use client'

import { useTableState } from '@/src/hooks/use-table-state'
import { formatDateOnly } from '@/src/lib/timezone'
import { formatCurrency } from '@/src/lib/utils'
import { PayCheck } from '@repo/db'
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
import { useMemo } from 'react'
import { usePaycheckListQuery } from '../queries'
import PayCheckActions from './paycheck-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — суммы и даты. */
const COLUMN_WIDTH = 130

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

function buildColumns(userId: number, userName: string): ColumnDef<PayCheck>[] {
  return [
    {
      id: 'date',
      header: 'Дата',
      accessorKey: 'date',
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatDateOnly(row.original.date),
      meta: { title: 'Дата', className: NUMERIC },
    },
    {
      id: 'amount',
      header: 'Сумма',
      accessorKey: 'amount',
      size: COLUMN_WIDTH,
      cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.amount)}</span>,
      meta: { title: 'Сумма', className: NUMERIC },
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
      cell: ({ row }) => (
        <PayCheckActions paycheck={row.original} userName={userName} userId={userId} />
      ),
    },
  ]
}

/** Выплаты одному сотруднику: список ограничен им, отбор и нарезка — на клиенте. */
export default function PayChecksTable({ userId, userName }: { userId: number; userName: string }) {
  const { data: paychecks = [], isLoading, isError } = usePaycheckListQuery(userId)
  // Свой id на сотрудника не нужен: колонки у всех те же, и настройка одна.
  const t = useTableState({ id: 'paychecks' })

  const columns = useMemo(() => buildColumns(userId, userName), [userId, userName])

  const table = useReactTable({
    data: paychecks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
    globalFilterFn: (row, _columnId, filterValue) =>
      (row.original.comment ?? '').toLowerCase().includes(String(filterValue).toLowerCase()),
    onPaginationChange: t.setPagination,
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: {
      globalFilter: t.globalFilter,
      pagination: t.pagination,
      sorting: t.sorting,
      columnVisibility: t.columnVisibility,
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (isError) {
    return <div className="text-destructive">Ошибка при загрузке выплат.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет чеков."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Комментарий..."
          onReset={t.reset}
        />
      }
    />
  )
}
