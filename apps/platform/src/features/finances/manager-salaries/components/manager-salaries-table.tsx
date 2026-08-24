'use client'

import { useTableState } from '@/src/hooks/use-table-state'
import { formatDateOnly } from '@/src/lib/timezone'
import { formatCurrency } from '@/src/lib/utils'
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
import { useManagerSalaryListQuery } from '../queries'
import type { ManagerSalaryWithUser } from '../types'
import ManagerSalaryActions from './manager-salary-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — суммы и периода. */
const COLUMN_WIDTH = 130
const PERIOD_WIDTH = 200

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/** «Ежемесячно с августа 2026» или «1 авг. 2026 - 31 дек. 2026». */
function periodLabel(salary: ManagerSalaryWithUser) {
  if (salary.endDate === null) {
    const startMonthYear = formatDateOnly(salary.startDate, { month: 'long', year: 'numeric' })
    return `Ежемесячно с ${startMonthYear}`
  }
  const opts = { day: 'numeric', month: 'short', year: 'numeric' } as const
  return `${formatDateOnly(salary.startDate, opts)} - ${formatDateOnly(salary.endDate, opts)}`
}

const columns: ColumnDef<ManagerSalaryWithUser>[] = [
  {
    id: 'user',
    header: 'Менеджер',
    accessorFn: (row) => row.user.name,
    meta: { title: 'Менеджер', flexible: true },
    // Строка без менеджера бессмысленна — прятать нечего.
    enableHiding: false,
  },
  {
    id: 'monthlyAmount',
    header: 'Сумма в месяц',
    accessorKey: 'monthlyAmount',
    size: COLUMN_WIDTH,
    cell: ({ row }) => formatCurrency(row.original.monthlyAmount),
    meta: { title: 'Сумма в месяц', className: NUMERIC },
  },
  {
    id: 'period',
    header: 'Период',
    // Сортируем по дате начала: сама подпись — текст, и по нему порядок был бы
    // алфавитным, то есть случайным.
    accessorFn: (row) => row.startDate,
    size: PERIOD_WIDTH,
    cell: ({ row }) => periodLabel(row.original),
    meta: { title: 'Период' },
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
    cell: ({ row }) => <ManagerSalaryActions salary={row.original} />,
  },
]

/** Оклады менеджеров: их единицы, отбор и нарезка — на клиенте. */
export default function ManagerSalariesTable() {
  const { data: salaries = [], isLoading, isError } = useManagerSalaryListQuery()
  const t = useTableState({ id: 'manager-salaries' })

  const table = useReactTable({
    data: salaries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase()
      return (
        row.original.user.name.toLowerCase().includes(search) ||
        (row.original.comment?.toLowerCase().includes(search) ?? false)
      )
    },
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
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError) {
    return <div className="text-destructive">Ошибка при загрузке зарплат.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет записей о зарплатах."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Менеджер или комментарий..."
          onReset={t.reset}
        />
      }
    />
  )
}
