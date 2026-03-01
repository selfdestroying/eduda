'use client'

import { Button } from '@/src/components/ui/button'
import { Label } from '@/src/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table'
import { cn } from '@/src/lib/utils'
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { type ReactNode } from 'react'

interface DataTableProps<TData> {
  table: TanstackTable<TData>
  /** Текст пустого состояния */
  emptyMessage?: string
  /** Показывать ли пагинацию */
  showPagination?: boolean
  /** Слот для тулбара (поиск, фильтры и т.д.) */
  toolbar?: ReactNode
}

export default function DataTable<TData>({
  table,
  emptyMessage = 'Нет данных.',
  showPagination = false,
  toolbar,
}: DataTableProps<TData>) {
  const columnCount = table.getAllColumns().length

  return (
    <div className="flex h-full flex-col gap-2">
      {toolbar}
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
                          'flex w-fit cursor-pointer items-center gap-2 select-none',
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(e) => {
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
              <TableCell colSpan={columnCount} className="h-24 text-center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {showPagination && <DataTablePagination table={table} />}
    </div>
  )
}

function DataTablePagination<TData>({ table }: { table: TanstackTable<TData> }) {
  return (
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
  )
}
