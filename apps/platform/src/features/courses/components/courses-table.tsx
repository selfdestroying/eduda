'use client'

import { useTableState } from '@/src/hooks/use-table-state'
import { Course } from '@repo/db'
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
import { useCourseListQuery } from '../queries'
import CourseActions from './course-actions'

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

const columns: ColumnDef<Course>[] = [
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
    cell: ({ row }) => <CourseActions course={row.original} />,
  },
]

/**
 * Справочник курсов: их у школы десятки, и отбор с нарезкой остаются на клиенте.
 * Всё остальное — как у серверных таблиц: состояние в URL, тулбар общий, у
 * колонок `meta`.
 */
export default function CoursesTable() {
  const { data: courses = [], isLoading, isError } = useCourseListQuery()
  const t = useTableState({ id: 'courses' })

  const table = useReactTable({
    data: courses,
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
    return <div className="text-destructive">Ошибка при загрузке курсов.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет курсов."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Название курса..."
          onReset={t.reset}
        />
      }
    />
  )
}
