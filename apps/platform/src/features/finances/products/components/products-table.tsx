'use client'

import { useTableState } from '@/src/hooks/use-table-state'
import { formatCurrency } from '@/src/lib/utils'
import { Product } from '@repo/db'
import { Badge } from '@repo/ui/components/badge'
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
import { useProductListQuery } from '../queries'
import ProductActions from './product-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — цен, количества, статуса. */
const COLUMN_WIDTH = 130

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Колонки, по которым фильтруем. Отбор клиентский, поэтому у колонки есть свой
 * `filterFn`: он сверяет значение со списком строк, приходящим из тулбара.
 */
const TABLE_FILTERS = { isActive: 'string' } as const

const STATUS_OPTIONS = [
  { label: 'В продаже', value: 'true' },
  { label: 'Снят с продажи', value: 'false' },
]

const columns: ColumnDef<Product>[] = [
  {
    id: 'name',
    header: 'Название',
    accessorKey: 'name',
    meta: { title: 'Название', flexible: true },
    // Строка без названия бессмысленна — прятать нечего.
    enableHiding: false,
  },
  {
    // Деньги раньше количества: на прайс-листе цена — главная цифра, а занятия
    // объясняют, из чего она сложилась.
    id: 'price',
    header: 'Цена пакета',
    accessorKey: 'price',
    size: COLUMN_WIDTH,
    cell: ({ row }) => formatCurrency(row.original.price),
    meta: { title: 'Цена пакета', className: NUMERIC },
  },
  {
    id: 'lessonCount',
    header: 'Занятий',
    accessorKey: 'lessonCount',
    size: COLUMN_WIDTH,
    meta: { title: 'Занятий', className: NUMERIC },
  },
  {
    // Считаем на чтение, а не храним: это то же деление, что показывает форма, и
    // лишняя колонка в БД разъезжалась бы с ценой при каждой правке.
    id: 'perLesson',
    header: 'За занятие',
    accessorFn: (row) => (row.lessonCount > 0 ? row.price / row.lessonCount : 0),
    size: COLUMN_WIDTH,
    cell: ({ row }) =>
      row.original.lessonCount > 0
        ? formatCurrency(row.original.price / row.original.lessonCount, 1)
        : '—',
    meta: { title: 'За занятие', className: NUMERIC },
  },
  {
    id: 'description',
    header: 'Описание',
    accessorKey: 'description',
    cell: ({ row }) => row.original.description || '—',
    enableSorting: false,
    meta: { title: 'Описание', flexible: true },
  },
  {
    id: 'isActive',
    header: 'Статус',
    accessorKey: 'isActive',
    size: COLUMN_WIDTH,
    cell: ({ row }) =>
      row.original.isActive ? (
        <Badge>В продаже</Badge>
      ) : (
        <Badge variant="secondary">Снят с продажи</Badge>
      ),
    // Значения фильтра — строки: они едут в URL и обратно приходят строками.
    filterFn: (row, _id, filterValue) => {
      const selected = filterValue as string[]
      return selected.length === 0 || selected.includes(String(row.original.isActive))
    },
    meta: { title: 'Статус', variant: 'multiSelect', options: STATUS_OPTIONS },
  },
  {
    id: 'actions',
    header: () => null,
    size: ACTIONS_WIDTH,
    enableHiding: false,
    cell: ({ row }) => <ProductActions product={row.original} />,
  },
]

/** Прайс-лист: строк десятки, отбор и нарезка остаются на клиенте. */
export default function ProductsTable() {
  const { data: products = [], isLoading, isError } = useProductListQuery()
  const t = useTableState({ id: 'finance-products', filters: TABLE_FILTERS })

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.name.toLowerCase().includes(String(filterValue).toLowerCase()),
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
    return <div className="text-destructive">Ошибка при загрузке продуктов.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет продуктов."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Название продукта..."
          onReset={t.reset}
        />
      }
    />
  )
}
