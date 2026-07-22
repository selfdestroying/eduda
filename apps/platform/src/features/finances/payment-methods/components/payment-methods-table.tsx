'use client'

import { PaymentMethod } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { Badge } from '@/src/components/ui/badge'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
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
import { usePaymentMethodListQuery } from '../queries'
import PaymentMethodActions from './payment-method-actions'

export default function PaymentMethodsTable() {
  const { data: methods = [], isLoading, isError } = usePaymentMethodListQuery()

  const columns: ColumnDef<PaymentMethod>[] = useMemo(
    () => [
      {
        header: 'Название',
        accessorKey: 'name',
      },
      {
        header: 'Комиссия',
        accessorKey: 'commission',
        cell: ({ row }) => <span className="tabular-nums">{`${row.original.commission}%`}</span>,
      },
      {
        header: 'Описание',
        accessorKey: 'description',
        cell: ({ row }) => row.original.description || '-',
      },
      {
        header: 'Статус',
        accessorKey: 'isActive',
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge>Активен</Badge>
          ) : (
            <Badge variant="secondary">Неактивен</Badge>
          ),
      },
      {
        id: 'actions',
        cell: ({ row }) => <PaymentMethodActions paymentMethod={row.original} />,
      },
    ],
    [],
  )

  const { globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting } =
    useTableSearchParams()

  const table = useReactTable({
    data: methods,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      return row.original.name.toLowerCase().includes(searchValue)
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
    return <div className="text-destructive">Ошибка при загрузке методов оплаты.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет методов оплаты."
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
