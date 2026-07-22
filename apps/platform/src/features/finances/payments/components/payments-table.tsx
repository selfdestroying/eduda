'use client'

import DataTable from '@/src/components/data-table'
import { Hint } from '@/src/components/hint'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatDateOnly } from '@/src/lib/timezone'
import { getFullName } from '@/src/lib/utils'
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
import Link from 'next/link'
import { useMemo } from 'react'
import { usePaymentListQuery } from '../queries'
import type { PaymentWithStudentAndGroup } from '../types'
import PaymentActions from './payment-actions'

export default function PaymentsTable() {
  const { data: payments = [], isLoading, isError } = usePaymentListQuery()

  const columns: ColumnDef<PaymentWithStudentAndGroup>[] = useMemo(
    () => [
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
        header: () => (
          <span className="flex items-center gap-0.5">
            Занятий оплачено
            <Hint text="Количество уроков, зачисленных на баланс кошелька ученика по этой оплате." />
          </span>
        ),
        accessorKey: 'lessonCount',
      },
      {
        header: 'Сумма',
        accessorKey: 'price',
      },
      {
        header: () => (
          <span className="flex items-center gap-0.5">
            Ставка за урок
            <Hint text="Стоимость одного урока = сумма оплаты / количество оплаченных занятий." />
          </span>
        ),
        accessorKey: 'bidForLesson',
      },
      {
        header: 'Дата оплаты',
        accessorKey: 'date',
        cell: ({ row }) => formatDateOnly(row.original.date),
      },
      {
        header: 'Метод оплаты',
        cell: ({ row }) => row.original.paymentMethod?.name ?? 'Неизвестно',
      },
      {
        id: 'actions',
        cell: ({ row }) => <PaymentActions payment={row.original} />,
      },
    ],
    [],
  )

  const { globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting } =
    useTableSearchParams()

  const table = useReactTable({
    data: payments,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      const fullName = getFullName(
        row.original.student.firstName,
        row.original.student.lastName,
      ).toLowerCase()
      return fullName.includes(searchValue)
    },
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { pagination, sorting, globalFilter },
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
    return <div className="text-destructive">Ошибка при загрузке оплат.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет оплат."
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
