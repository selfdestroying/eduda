'use client'

import {
  ColumnDef,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { ProductWithCategory } from '@/src/actions/products'
import DataTable from '@/src/components/data-table'
import { Input } from '@/src/components/ui/input'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { useMemo } from 'react'

import { Category } from '@/prisma/generated/client'
import TableFilter, { TableFilterItem } from '@/src/components/table-filter'
import Image from 'next/image'
import ProductActions from './product-actions'

export default function ProductsTable({
  data,
  categories,
}: {
  data: ProductWithCategory[]
  categories: Category[]
}) {
  const columns: ColumnDef<ProductWithCategory>[] = useMemo(
    () => [
      {
        header: 'Картинка',
        accessorKey: 'image',
        cell: ({ row }) => (
          <div className="relative h-12 w-12 min-w-12 overflow-hidden rounded-lg">
            <Image
              src={row.original.image}
              alt={row.original.name}
              fill
              className="object-cover"
              sizes="50px"
            />
          </div>
        ),
      },
      {
        header: 'Название',
        accessorKey: 'name',
      },
      {
        header: 'Описание',
        accessorKey: 'description',
      },
      {
        header: 'Цена',
        accessorKey: 'price',
      },
      {
        id: 'category',
        header: 'Категория',
        accessorFn: (row) => row.category.name,
        filterFn: (row, id, filterValue) => {
          const categoryName = row.getValue<string>(id).toLowerCase()
          const selectedCategories = (filterValue as string[]).map((value) => value.toLowerCase())
          return selectedCategories.length === 0 || selectedCategories.includes(categoryName)
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => <ProductActions product={row.original} categories={categories} />,
      },
    ],
    [categories],
  )
  const {
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    sorting,
    setSorting,
  } = useTableSearchParams({
    filters: { category: 'string' },
    search: true,
    pagination: true,
    sorting: true,
  })

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      const fullName = row.original.name.toLowerCase()
      return fullName.includes(searchValue)
    },
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),

    state: {
      columnFilters,
      globalFilter,
      pagination,
      sorting,
    },
  })

  const handleCategoryFilterChange = (selectedCategories: TableFilterItem[]) => {
    const selectedValues = selectedCategories.map((category) => category.label.toLowerCase())
    setColumnFilters((prev) => {
      const filtered = prev.filter((filter) => filter.id !== 'category')
      if (selectedValues.length > 0) {
        filtered.push({
          id: 'category',
          value: selectedValues,
        })
      }
      return filtered
    })
  }

  const mappedCategories = useMemo(
    () => categories.map((category) => ({ label: category.name, value: category.id.toString() })),
    [categories],
  )

  const selectedCategories = useMemo(() => {
    const filter = columnFilters.find((f) => f.id === 'category')
    if (!filter) return []
    const values = filter.value as string[]
    return mappedCategories.filter((c) => values.includes(c.label.toLowerCase()))
  }, [columnFilters, mappedCategories])

  return (
    <DataTable
      table={table}
      emptyMessage="Нет товаров."
      showPagination
      toolbar={
        <div className="flex flex-col items-end gap-2 md:flex-row">
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Поиск..."
          />
          <TableFilter
            label="Категория"
            items={mappedCategories}
            value={selectedCategories}
            onChange={handleCategoryFilterChange}
          />
        </div>
      }
    />
  )
}
