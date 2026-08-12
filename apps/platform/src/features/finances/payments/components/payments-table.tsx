'use client'

import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { Hint } from '@repo/ui/components/hint'
import { Input } from '@repo/ui/components/input'
import { Skeleton } from '@repo/ui/components/skeleton'
import { useColumnVisibility } from '@/src/hooks/use-column-visibility'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatDateOnly, formatDateTimeInTz } from '@/src/lib/timezone'
import { formatCurrency, getFullName } from '@/src/lib/utils'
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

/** Правая выключка + моноширинные цифры: колонки сумм должны читаться столбиком. */
const NUMERIC = 'text-right tabular-nums'

function buildColumns(tz: string): ColumnDef<PaymentListItem>[] {
  return [
    {
      id: 'student',
      header: 'Ученик',
      // Подпись кошелька уходит второй строкой: она нужна, чтобы отличить два
      // пакета одного ученика, но заголовка колонки не заслуживает.
      accessorFn: (row) => getFullName(row.student.firstName, row.student.lastName),
      cell: ({ row }) => {
        const { student, walletLabel, status, isAdjustment, cancelledAt } = row.original
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/students/${student.id}`}
                className="text-primary truncate hover:underline"
              >
                {getFullName(student.firstName, student.lastName)}
              </Link>
              {/* Пояснение — нативным `title`: `Hint` рисует кнопку в 24px, а
                  бейдж высотой 20px с `overflow-hidden` её обрезает. */}
              {status === 'CANCELLED' && (
                <Badge
                  variant="destructive"
                  title={
                    cancelledAt ? `Отменена ${formatDateTimeInTz(cancelledAt, tz)}` : undefined
                  }
                >
                  Отменена
                </Badge>
              )}
              {isAdjustment && (
                <Badge
                  variant="outline"
                  title="Не оплата, а выравнивание остатка кошелька при переходе на пакеты. Денег за такой записью нет."
                >
                  Корректировка
                </Badge>
              )}
            </div>
            {walletLabel && (
              <span className="text-muted-foreground truncate text-xs" title={walletLabel}>
                {walletLabel}
              </span>
            )}
          </div>
        )
      },
      // Ширину задаём здесь, иначе `truncate` ничего не режет: подпись кошелька
      // из нескольких групп растянула бы колонку и вытолкнула суммы за экран.
      meta: { title: 'Ученик', className: 'max-w-64' },
      // Строка без ученика бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'lessons',
      header: () => (
        <span className="flex items-center gap-0.5">
          Занятий
          <Hint text="Сколько уроков зачислено на баланс кошелька этой оплатой и сколько из них ещё не потрачено." />
        </span>
      ),
      accessorFn: (row) => row.lessonCount,
      cell: ({ row }) => {
        const { lessonCount, remaining, status } = row.original
        return (
          <div className="flex flex-col">
            <span>{lessonCount}</span>
            {/* `null` — пакет до разметки остатков, врать «осталось 0» нельзя.
                У отменённой оплаты остаток обнулён самой отменой, и «потрачен»
                там означало бы, что уроки отходили, — а их сняли с баланса. */}
            {remaining !== null && status !== 'CANCELLED' && (
              <span className="text-muted-foreground text-xs">
                {remaining > 0 ? `осталось ${remaining}` : 'потрачен'}
              </span>
            )}
          </div>
        )
      },
      meta: { title: 'Занятий', className: NUMERIC },
    },
    {
      id: 'price',
      header: 'Сумма',
      accessorFn: (row) => row.price,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{formatCurrency(row.original.price)}</span>
          <span className="text-muted-foreground text-xs">
            {formatCurrency(row.original.bidForLesson)} / занятие
          </span>
        </div>
      ),
      meta: { title: 'Сумма', className: NUMERIC },
    },
    {
      id: 'date',
      header: 'Дата',
      accessorKey: 'date',
      cell: ({ row }) => formatDateOnly(row.original.date),
      meta: { title: 'Дата', className: 'whitespace-nowrap' },
    },
    {
      id: 'paymentMethod',
      header: 'Метод',
      accessorFn: (row) => row.paymentMethod?.name ?? '',
      cell: ({ row }) => row.original.paymentMethod?.name ?? '—',
      meta: { title: 'Метод оплаты' },
    },
    {
      id: 'manager',
      header: () => (
        <span className="flex items-center gap-0.5">
          Менеджер
          <Hint text="Кто продал этот пакет. У оплат, заведённых до появления поля, менеджер не указан." />
        </span>
      ),
      accessorFn: (row) => row.manager?.name ?? '',
      cell: ({ row }) => row.original.manager?.name ?? '—',
      meta: { title: 'Менеджер' },
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => <PaymentActions payment={row.original} />,
    },
  ]
}

export default function PaymentsTable() {
  // Период пока не выбирается: сервер отдаёт текущий месяц. Выбор периода
  // приезжает вместе с панелью фильтров.
  const { data: payments = [], isLoading, isError } = usePaymentListQuery({})
  const tz = useOrgTimezone()

  const columns = useMemo(() => buildColumns(tz), [tz])

  const { globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting } =
    useTableSearchParams()
  const { columnVisibility, setColumnVisibility } = useColumnVisibility('payments')

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
    onColumnVisibilityChange: setColumnVisibility,
    state: { pagination, sorting, globalFilter, columnVisibility },
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
      showColumnVisibility
      // Отменённая оплата остаётся в списке следом операции, но читаться должна
      // как погашенная — одного бейджа в широкой строке не видно.
      rowClassName={(row) => (row.original.status === 'CANCELLED' ? 'opacity-55' : undefined)}
      toolbar={
        <Input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Поиск по ученику..."
          className="md:max-w-xs"
        />
      }
    />
  )
}
