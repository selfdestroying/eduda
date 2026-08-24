'use client'

import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { useTableState } from '@/src/hooks/use-table-state'
import { formatDateTimeInTz } from '@/src/lib/timezone'
import { UnprocessedPayment } from '@repo/db'
import { Button } from '@repo/ui/components/button'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog'
import { Skeleton } from '@repo/ui/components/skeleton'
import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { FileJson } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useUnprocessedPaymentListQuery } from '../queries'
import UnprocessedPaymentActions from './unprocessed-payment-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — статуса и даты. */
const COLUMN_WIDTH = 130

/** Кнопка «показать JSON» — иконка и ничего больше. */
const RAW_WIDTH = 90

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Колонки, по которым фильтруем. Отбор клиентский, поэтому у колонки есть свой
 * `filterFn`: он сверяет значение со списком строк, приходящим из тулбара.
 */
const TABLE_FILTERS = { resolved: 'string' } as const

const STATUS_OPTIONS = [
  { label: 'Неразобрано', value: 'false' },
  { label: 'Разобрано', value: 'true' },
]

function buildColumns(tz: string): ColumnDef<UnprocessedPayment>[] {
  return [
    {
      id: 'resolved',
      header: 'Статус',
      accessorKey: 'resolved',
      size: COLUMN_WIDTH,
      cell: ({ row }) => (
        <span className={row.original.resolved ? 'text-success' : 'text-destructive'}>
          {row.original.resolved ? 'Разобрано' : 'Неразобрано'}
        </span>
      ),
      // Значения фильтра — строки: они едут в URL и обратно приходят строками.
      filterFn: (row, _id, filterValue) => {
        const selected = filterValue as string[]
        return selected.length === 0 || selected.includes(String(row.original.resolved))
      },
      meta: { title: 'Статус', variant: 'multiSelect', options: STATUS_OPTIONS },
    },
    {
      id: 'reason',
      header: 'Причина',
      accessorKey: 'reason',
      meta: { title: 'Причина', flexible: true },
      // Строка без причины ничего не объясняет — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'rawData',
      header: 'Данные',
      size: RAW_WIDTH,
      enableSorting: false,
      cell: ({ row }) => (
        <Dialog>
          <DialogTrigger render={<Button variant="outline" size="icon" />}>
            <FileJson />
          </DialogTrigger>
          <DialogContent className="flex flex-col gap-0 p-0 sm:max-h-[min(640px,80vh)] sm:max-w-lg [&>button:last-child]:hidden">
            <div className="overflow-y-auto">
              <DialogHeader className="contents space-y-0 text-left">
                <DialogTitle className="sr-only px-6 pt-6">Необработанные данные</DialogTitle>
                <DialogDescription
                  render={
                    <div className="[&_strong]:text-foreground space-y-4 p-6 [&_strong]:font-semibold" />
                  }
                >
                  <pre>
                    <code lang="json">{JSON.stringify(row.original.rawData, null, 2)}</code>
                  </pre>
                </DialogDescription>
              </DialogHeader>
            </div>
          </DialogContent>
        </Dialog>
      ),
      meta: { title: 'Данные' },
    },
    {
      id: 'createdAt',
      header: 'Дата',
      accessorKey: 'createdAt',
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatDateTimeInTz(row.original.createdAt, tz),
      meta: { title: 'Дата', className: NUMERIC },
    },
    {
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => <UnprocessedPaymentActions unprocessedPayment={row.original} />,
    },
  ]
}

/**
 * Неразобранные оплаты: их копится немного и разбирают их сразу, поэтому отбор и
 * нарезка остаются на клиенте.
 */
export default function UnprocessedPaymentTable() {
  const { data: payments = [], isLoading, isError } = useUnprocessedPaymentListQuery()
  const tz = useOrgTimezone()
  const t = useTableState({ id: 'unprocessed-payments', filters: TABLE_FILTERS })

  const columns = useMemo(() => buildColumns(tz), [tz])

  // Страница называется «Неразобранные», и открывать её показом уже разобранного
  // незачем. Отбор пишем в адрес один раз при входе, а не подставляем на каждый
  // рендер: подставляемый нельзя было бы снять — сняв галочку, человек получал бы
  // его обратно. Ссылка при этом остаётся честной: что в адресе, то и в таблице.
  const applied = useRef(false)
  useEffect(() => {
    if (applied.current) return
    applied.current = true
    if (t.columnFilters.length === 0) {
      t.setColumnFilters([{ id: 'resolved', value: ['false'] }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const table = useReactTable({
    data: payments,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.reason.toLowerCase().includes(String(filterValue).toLowerCase()),
    onPaginationChange: t.setPagination,
    onColumnFiltersChange: t.setColumnFilters,
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: {
      globalFilter: t.globalFilter,
      columnFilters: t.columnFilters,
      pagination: t.pagination,
      sorting: t.sorting,
      columnVisibility: t.columnVisibility,
    },
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
    return <div className="text-destructive">Ошибка при загрузке неразобранных оплат.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет неразобранных оплат."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Причина..."
          onReset={t.reset}
        />
      }
    />
  )
}
