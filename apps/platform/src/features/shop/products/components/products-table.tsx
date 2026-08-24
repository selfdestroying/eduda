'use client'

import { useTableState } from '@/src/hooks/use-table-state'
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
import { Coins } from 'lucide-react'
import Image from 'next/image'
import { useMemo } from 'react'
import { useCategoryListQuery } from '../../categories/queries'
import { useProductListQuery } from '../queries'
import type { ProductWithCategory } from '../types'
import ProductActions from './product-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — цены, остатка, категории. */
const COLUMN_WIDTH = 130

/** Превью товара — квадрат 48px плюс отступы ячейки. */
const IMAGE_WIDTH = 80

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Колонки, по которым фильтруем. Отбор клиентский, поэтому у колонки есть свой
 * `filterFn`: он сверяет id категории со списком строк, приходящим из тулбара.
 */
const TABLE_FILTERS = { category: 'string' } as const

type FilterOption = { label: string; value: string }

function buildColumns(categories: FilterOption[]): ColumnDef<ProductWithCategory>[] {
  return [
    {
      id: 'image',
      header: 'Картинка',
      size: IMAGE_WIDTH,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="relative h-12 w-12 min-w-12 overflow-hidden rounded-lg">
          <Image
            src={row.original.imageUrl}
            alt={row.original.name}
            fill
            className="object-cover"
            sizes="50px"
          />
        </div>
      ),
      meta: { title: 'Картинка' },
    },
    {
      id: 'name',
      header: 'Название',
      accessorKey: 'name',
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="truncate">{row.original.name}</span>
          {row.original.archivedAt && <Badge variant="secondary">в архиве</Badge>}
        </span>
      ),
      meta: { title: 'Название', flexible: true },
      // Строка без названия бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'price',
      header: 'Цена',
      accessorKey: 'price',
      size: COLUMN_WIDTH,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          {row.original.price} <Coins className="text-primary h-4 w-4" />
        </span>
      ),
      meta: { title: 'Цена', className: NUMERIC },
    },
    {
      id: 'quantity',
      header: 'Количество',
      accessorKey: 'quantity',
      size: COLUMN_WIDTH,
      meta: { title: 'Количество', className: NUMERIC },
    },
    {
      id: 'category',
      header: 'Категория',
      accessorFn: (row) => row.category.name,
      size: COLUMN_WIDTH,
      // По id, а не по названию: категорию переименовывают, и фильтр в чужой
      // ссылке после этого молча переставал отбирать.
      filterFn: (row, _id, filterValue) => {
        const selected = filterValue as string[]
        return selected.length === 0 || selected.includes(String(row.original.category.id))
      },
      meta: { title: 'Категория', variant: 'multiSelect', options: categories },
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
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => <ProductActions product={row.original} />,
    },
  ]
}

/** Витрина магазина: товаров десятки, отбор и нарезка остаются на клиенте. */
export default function ProductsTable() {
  const { data: products = [], isLoading: isProductsLoading, isError } = useProductListQuery()
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategoryListQuery()
  const isLoading = isProductsLoading || isCategoriesLoading

  const t = useTableState({ id: 'shop-products', filters: TABLE_FILTERS })

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ label: c.name, value: String(c.id) })),
    [categories],
  )
  const columns = useMemo(() => buildColumns(categoryOptions), [categoryOptions])

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
    return <div className="text-destructive">Ошибка при загрузке товаров.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет товаров."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Название товара..."
          onReset={t.reset}
        />
      }
    />
  )
}
