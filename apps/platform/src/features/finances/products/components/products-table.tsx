'use client'

import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatCurrency } from '@/src/lib/utils'
import { Product } from '@repo/db'
import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { Input } from '@repo/ui/components/input'
import { Skeleton } from '@repo/ui/components/skeleton'
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { useProductListQuery } from '../queries'
import ProductActions from './product-actions'

/** Цифры моноширинными и по правому краю — только так разряды встают в столбик. */
const NUMERIC = 'text-right tabular-nums'

export default function ProductsTable() {
  const { data: products = [], isLoading, isError } = useProductListQuery()

  const columns: ColumnDef<Product>[] = useMemo(
    () => [
      {
        header: 'Название',
        accessorKey: 'name',
      },
      {
        header: 'Занятий',
        accessorKey: 'lessonCount',
        meta: { className: NUMERIC },
      },
      {
        header: 'Цена пакета',
        accessorKey: 'price',
        cell: ({ row }) => formatCurrency(row.original.price),
        meta: { className: NUMERIC },
      },
      {
        // Считаем на чтение, а не храним: это то же деление, что показывает форма,
        // и лишняя колонка в БД разъезжалась бы с ценой при каждой правке.
        id: 'perLesson',
        header: 'За занятие',
        accessorFn: (row) => (row.lessonCount > 0 ? row.price / row.lessonCount : 0),
        cell: ({ row }) =>
          row.original.lessonCount > 0
            ? formatCurrency(row.original.price / row.original.lessonCount, 1)
            : '-',
        meta: { className: NUMERIC },
      },
      {
        header: 'Описание',
        accessorKey: 'description',
        cell: ({ row }) => row.original.description || '-',
      },
      {
        header: 'Статус',
        accessorKey: 'isActive',
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge>В продаже</Badge>
          ) : (
            <Badge variant="secondary">Снят с продажи</Badge>
          ),
      },
      {
        id: 'actions',
        cell: ({ row }) => <ProductActions product={row.original} />,
      },
    ],
    [],
  )

  const { globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting } =
    useTableSearchParams()

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      return row.original.name.toLowerCase().includes(searchValue)
    },
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { globalFilter, pagination, sorting },
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
