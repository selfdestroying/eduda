'use client'

import { useTableState } from '@/src/hooks/use-table-state'
import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
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
import { useMemo } from 'react'
import { useGroupTypeListQuery } from '../queries'
import type { GroupTypeWithRelations } from '../types'
import GroupTypeActions from './group-type-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — ставки и счётчика. */
const COLUMN_WIDTH = 130

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Вне компонента: `useHasPermission` мемоизирует по ссылке на объект, и литерал
 * внутри пересчитывал бы проверку на каждый рендер.
 */
const EDIT_PERMISSION = { groupType: ['update'] } as const

function buildColumns(canEdit: boolean): ColumnDef<GroupTypeWithRelations>[] {
  const columns: ColumnDef<GroupTypeWithRelations>[] = [
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
      id: 'rate',
      header: 'Ставка',
      accessorFn: (row) => row.rate.bid,
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatCurrency(row.original.rate.bid),
      meta: { title: 'Ставка', className: NUMERIC },
    },
    {
      id: 'rateName',
      header: 'Название ставки',
      accessorFn: (row) => row.rate.name,
      meta: { title: 'Название ставки', flexible: true },
    },
    {
      id: 'bonusPerStudent',
      header: 'Бонус за уч.',
      accessorFn: (row) => row.rate.bonusPerStudent,
      size: COLUMN_WIDTH,
      cell: ({ row }) =>
        row.original.rate.bonusPerStudent > 0
          ? formatCurrency(row.original.rate.bonusPerStudent)
          : '—',
      meta: { title: 'Бонус за уч.', className: NUMERIC },
    },
    {
      id: 'groups',
      header: 'Групп',
      accessorFn: (row) => row._count.groups,
      size: COLUMN_WIDTH,
      meta: { title: 'Групп', className: NUMERIC },
    },
  ]

  if (canEdit) {
    columns.push({
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => <GroupTypeActions groupType={row.original} />,
    })
  }

  return columns
}

/** Справочник типов групп: их единицы, отбор и нарезка — на клиенте. */
export default function GroupTypesTable() {
  const { data: groupTypes = [], isLoading, isError } = useGroupTypeListQuery()
  const canEdit = useHasPermission(EDIT_PERMISSION)
  const t = useTableState({ id: 'group-types' })

  const columns = useMemo(() => buildColumns(canEdit), [canEdit])

  const table = useReactTable({
    data: groupTypes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase()
      return (
        row.original.name.toLowerCase().includes(search) ||
        row.original.rate.name.toLowerCase().includes(search)
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
    return <div className="text-destructive">Ошибка при загрузке типов групп.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет типов групп. Создайте первый тип группы."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Тип или ставка..."
          onReset={t.reset}
        />
      }
    />
  )
}
