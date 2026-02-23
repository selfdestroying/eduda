'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileJson,
} from 'lucide-react'

import TableFilter, { TableFilterItem } from '@/src/components/table-filter'
import { Button } from '@/src/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table'
import { toZonedTime } from 'date-fns-tz'
import { useMemo, useState } from 'react'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'

import { Prisma, UnprocessedPayment } from '@/prisma/generated/client'
import { Label } from '@/src/components/ui/label'
import { cn } from '@/src/lib/utils'
import UnprocessedPaymentsActions from './unprocessed-payment-actions'

const filterOptions: TableFilterItem[] = [
  { label: 'Разобрано', value: 'resolved' },
  { label: 'Неразобрано', value: 'unresolved' },
]

type StudentWithGroups = Prisma.StudentGetPayload<{
  include: {
    groups: {
      include: {
        group: { include: { course: true; location: true } }
      }
    }
  }
}>

export default function UnprocessedPaymentTable({
  data,
  students,
}: {
  data: UnprocessedPayment[]
  students: StudentWithGroups[]
}) {
  const columns: ColumnDef<UnprocessedPayment>[] = useMemo(
    () => [
      {
        id: 'resolved',
        header: 'Статус',
        accessorKey: 'resolved',
        cell: ({ row }) => (
          <span className={row.original.resolved ? 'text-success' : 'text-destructive'}>
            {row.original.resolved ? 'Разобрано' : 'Неразобрано'}
          </span>
        ),
        filterFn: (row, id, filterValues) => {
          if (filterValues.length === 0) return true
          const isResolved = row.original.resolved
          if (isResolved && filterValues.includes('resolved')) return true
          if (!isResolved && filterValues.includes('unresolved')) return true
          return false
        },
      },
      {
        header: 'Причина',
        accessorKey: 'reason',
      },
      {
        header: 'Необработанные данные',
        accessorKey: 'rawData',
        cell: ({ row }) => (
          <Dialog>
            <DialogTrigger render={<Button variant={'outline'} size={'icon'} />}>
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
      },
      {
        header: 'Дата',
        accessorKey: 'createdAt',
        cell: ({ row }) =>
          toZonedTime(row.original.createdAt, 'Europe/Moscow').toLocaleString('ru-RU'),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <UnprocessedPaymentsActions students={students} unprocessedPayment={row.original} />
        ),
      },
    ],
    [students]
  )
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: 'resolved', value: ['unresolved'] },
  ])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [filterValues, setFilterValues] = useState<TableFilterItem[]>([filterOptions[0]])
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      columnFilters,
      pagination,
      sorting,
    },
  })

  const handleResolvedFilterChange = (values: TableFilterItem[]) => {
    setFilterValues(values)
    const resolvedValues = values.map((v) => v.value)
    setColumnFilters((prev) => {
      const otherFilters = prev.filter((f) => f.id !== 'resolved')
      if (resolvedValues.length === 0) {
        return otherFilters
      }
      return [...otherFilters, { id: 'resolved', value: resolvedValues }]
    })
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-col items-end gap-2 md:flex-row">
        <TableFilter
          label="Статус"
          items={filterOptions}
          value={filterValues}
          onChange={handleResolvedFilterChange}
        />
      </div>
      <Table className="overflow-y-auto">
        <TableHeader className="bg-card sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <div
                      className={cn(
                        header.column.getCanSort() &&
                          'flex w-fit cursor-pointer items-center gap-2 select-none'
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(e) => {
                        // Enhanced keyboard handling for sorting
                        if (header.column.getCanSort() && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          header.column.getToggleSortingHandler()?.(e)
                        }
                      }}
                      tabIndex={header.column.getCanSort() ? 0 : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ArrowUp className="shrink-0 opacity-60" size={16} />,
                        desc: <ArrowDown className="shrink-0 opacity-60" size={16} />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                Нет учеников.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end px-4">
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page">Строк на страницу:</Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger id="rows-per-page">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Label className="flex w-fit items-center justify-center">
              Страница {table.getState().pagination.pageIndex + 1} из {table.getPageCount()}
            </Label>
            <Button
              variant="outline"
              className="hidden lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">На первую страницу</span>
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">На предыдущую страницу</span>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">На следующую страницу</span>
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              className="hidden lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">На последнюю страницу</span>
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
