'use client'

import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { Hint } from '@repo/ui/components/hint'
import { Input } from '@repo/ui/components/input'
import { Skeleton } from '@repo/ui/components/skeleton'
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
import type { PaymentListItem } from '../types'
import PaymentActions from './payment-actions'

export default function PaymentsTable() {
  // Период пока не выбирается: сервер отдаёт текущий месяц. Выбор периода
  // приезжает вместе с панелью фильтров.
  const { data: payments = [], isLoading, isError } = usePaymentListQuery({})

  const columns: ColumnDef<PaymentListItem>[] = useMemo(
    () => [
      {
        header: 'Ученик',
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Link
              href={`/students/${row.original.student.id}`}
              className="text-primary hover:underline"
            >
              {getFullName(row.original.student.firstName, row.original.student.lastName)}
            </Link>
            {row.original.status === 'CANCELLED' && <Badge variant="outline">Отменена</Badge>}
          </span>
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
        header: () => (
          <span className="flex items-center gap-0.5">
            Менеджер
            <Hint text="Кто продал этот пакет. У оплат, заведённых до появления поля, менеджер не указан." />
          </span>
        ),
        id: 'manager',
        accessorFn: (row) => row.manager?.name ?? '',
        cell: ({ row }) => row.original.manager?.name ?? '—',
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
