'use client'

import { useTableState } from '@/src/hooks/use-table-state'
import { Category } from '@repo/db'
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
import { useCategoryListQuery } from '../queries'
import CategoryActions from './category-actions'

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

const columns: ColumnDef<Category>[] = [
  {
    id: 'name',
    header: 'Название',
    accessorKey: 'name',
    meta: { title: 'Название', flexible: true },
    // Строка без названия бессмысленна — прятать нечего.
    enableHiding: false,
  },
  {
    id: 'actions',
    header: () => null,
    size: ACTIONS_WIDTH,
    enableHiding: false,
    cell: ({ row }) => <CategoryActions category={row.original} />,
  },
]

/** Справочник категорий магазина: их единицы, отбор и нарезка — на клиенте. */
export default function CategoriesTable() {
  const { data: categories = [], isLoading, isError } = useCategoryListQuery()
  const t = useTableState({ id: 'shop-categories' })

  const table = useReactTable({
    data: categories,
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
    return <div className="text-destructive">Ошибка при загрузке категорий.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет категорий."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Название категории..."
          onReset={t.reset}
        />
      }
    />
  )
}
