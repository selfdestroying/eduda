'use client'

import { useTableState } from '@/src/hooks/use-table-state'
import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import { formatCurrency } from '@/src/lib/utils'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Hint } from '@repo/ui/components/hint'
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
import { useRateListQuery } from '../queries'
import type { RateWithCount } from '../types'
import RateActions from './rate-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — ставки, бонуса, счётчика. */
const COLUMN_WIDTH = 130

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Вне компонента: `useHasPermission` мемоизирует по ссылке на объект, и литерал
 * внутри пересчитывал бы проверку на каждый рендер.
 */
const EDIT_PERMISSION = { rate: ['update'] } as const

function buildColumns(canEdit: boolean): ColumnDef<RateWithCount>[] {
  const columns: ColumnDef<RateWithCount>[] = [
    {
      id: 'name',
      header: 'Название',
      accessorKey: 'name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      meta: { title: 'Название', flexible: true },
      // Строка без названия бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'bid',
      header: 'Ставка',
      accessorKey: 'bid',
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatCurrency(row.original.bid),
      meta: { title: 'Ставка', className: NUMERIC },
    },
    {
      id: 'bonusPerStudent',
      header: () => (
        <span className="flex items-center gap-0.5">
          Бонус за уч.
          <Hint text="Дополнительная надбавка к ставке преподавателя за каждого присутствующего ученика на уроке." />
        </span>
      ),
      accessorKey: 'bonusPerStudent',
      size: COLUMN_WIDTH,
      cell: ({ row }) =>
        row.original.bonusPerStudent > 0 ? formatCurrency(row.original.bonusPerStudent) : '—',
      meta: { title: 'Бонус за уч.', className: NUMERIC },
    },
    {
      id: 'linkedGroups',
      header: () => (
        <span className="flex items-center gap-0.5">
          Привязано групп
          <Hint text="Количество связей «преподаватель - группа», использующих эту ставку." />
        </span>
      ),
      accessorFn: (row) => row._count.teacherGroups,
      size: COLUMN_WIDTH,
      meta: { title: 'Привязано групп', className: NUMERIC },
    },
  ]

  if (canEdit) {
    columns.push({
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => <RateActions rate={row.original} />,
    })
  }

  return columns
}

/** Справочник ставок: их единицы, отбор и нарезка — на клиенте. */
export default function RatesTable() {
  const { data: rates = [], isLoading, isError } = useRateListQuery()
  const canEdit = useHasPermission(EDIT_PERMISSION)
  const t = useTableState({ id: 'rates' })

  const columns = useMemo(() => buildColumns(canEdit), [canEdit])

  const table = useReactTable({
    data: rates,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.name.toLowerCase().includes(String(filterValue).toLowerCase()),
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
    return <div className="text-destructive">Ошибка при загрузке ставок.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет ставок. Создайте первую ставку."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Название ставки..."
          onReset={t.reset}
        />
      }
    />
  )
}
