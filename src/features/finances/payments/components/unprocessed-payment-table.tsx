'use client'

import { UnprocessedPayment } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import TableFilter, { TableFilterItem } from '@/src/components/table-filter'
import { Button } from '@/src/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { formatDateTimeInTz } from '@/src/lib/timezone'
import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { FileJson } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useUnprocessedPaymentListQuery } from '../queries'
import UnprocessedPaymentActions from './unprocessed-payment-actions'

const filterOptions: TableFilterItem[] = [
  { label: 'Разобрано', value: 'resolved' },
  { label: 'Неразобрано', value: 'unresolved' },
]

export default function UnprocessedPaymentTable() {
  const { data: unprocessedPayments = [], isLoading, isError } = useUnprocessedPaymentListQuery()
  const tz = useOrgTimezone()

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
        cell: ({ row }) => formatDateTimeInTz(row.original.createdAt, tz),
      },
      {
        id: 'actions',
        cell: ({ row }) => <UnprocessedPaymentActions unprocessedPayment={row.original} />,
      },
    ],
    [tz],
  )

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: 'resolved', value: ['unresolved'] },
  ])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [filterValues, setFilterValues] = useState<TableFilterItem[]>([filterOptions[0]!])

  const table = useReactTable({
    data: unprocessedPayments,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      columnFilters,
      pagination,
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError) {
    return <div className="text-destructive">Ошибка при загрузке неразобранных оплат.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет неразобранных оплат."
      showPagination
      toolbar={
        <div className="flex flex-col items-end gap-2 md:flex-row">
          <TableFilter
            label="Статус"
            items={filterOptions}
            value={filterValues}
            onChange={handleResolvedFilterChange}
          />
        </div>
      }
    />
  )
}
