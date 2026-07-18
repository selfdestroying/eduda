'use client'

import DataTable from '@/src/components/data-table'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatDateOnly } from '@/src/lib/timezone'
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { useManagerSalaryListQuery } from '../queries'
import type { ManagerSalaryWithUser } from '../types'
import ManagerSalaryActions from './manager-salary-actions'

export default function ManagerRatesTable() {
  const { data: salaries = [], isLoading, isError } = useManagerSalaryListQuery()

  const columns: ColumnDef<ManagerSalaryWithUser>[] = useMemo(
    () => [
      {
        header: 'Менеджер',
        accessorFn: (row) => row.user.name,
        id: 'user',
      },
      {
        header: 'Сумма в месяц',
        accessorKey: 'monthlyAmount',
        cell: ({ row }) =>
          new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            maximumFractionDigits: 0,
          }).format(row.original.monthlyAmount),
      },
      {
        header: 'Период',
        id: 'period',
        accessorFn: (row) => new Date(row.startDate).getTime(),
        cell: ({ row }) => {
          const start = formatDateOnly(row.original.startDate, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
          if (row.original.endDate === null) {
            const startMY = formatDateOnly(row.original.startDate, {
              month: 'long',
              year: 'numeric',
            })
            return `Ежемесячно с ${startMY}`
          }
          const end = row.original.endDate
            ? formatDateOnly(row.original.endDate, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '-'
          return `${start} - ${end}`
        },
      },
      {
        header: 'Комментарий',
        accessorKey: 'comment',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.comment || '-'}</span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => <ManagerSalaryActions salary={row.original} />,
      },
    ],
    [],
  )

  const { pagination, setPagination, sorting, setSorting } = useTableSearchParams()

  const table = useReactTable({
    data: salaries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { pagination, sorting },
  })

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (isError) return <div className="text-destructive">Ошибка загрузки</div>

  return <DataTable table={table} emptyMessage="Нет записей о зарплатах." showPagination />
}
