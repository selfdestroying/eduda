'use client'

import DataTable from '@/src/components/data-table'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useOrganizationPermissionQuery } from '@/src/features/organization/queries'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatDateTimeInTz } from '@/src/lib/timezone'
import { getFullName } from '@/src/lib/utils'
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
import Link from 'next/link'
import { useMemo } from 'react'
import { useStudentListQuery } from '../queries'
import { StudentWithGroups } from '../types'
import DeleteStudentDialog from './detail/delete-student-dialog'

function getAggregateBalance(student: StudentWithGroups) {
  return student.wallets.reduce((sum, w) => sum + w.lessonsBalance, 0) + student.lessonsBalance
}

function formatActualizedDate(date: Date, tz: string) {
  return formatDateTimeInTz(date, tz, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function StudentsTable() {
  const { data: students = [], isLoading, isError } = useStudentListQuery()
  const { data: canDelete } = useOrganizationPermissionQuery({ student: ['delete'] })
  const tz = useOrgTimezone()

  const columns: ColumnDef<StudentWithGroups>[] = useMemo(() => {
    const base: ColumnDef<StudentWithGroups>[] = [
      {
        header: 'Имя',
        accessorFn: (value) => value.id,
        cell: ({ row }) => (
          <Link href={`/students/${row.original.id}`} className="text-primary hover:underline">
            {getFullName(row.original.firstName, row.original.lastName)}
          </Link>
        ),
      },
      {
        header: 'Возраст',
        accessorKey: 'age',
      },
      {
        header: 'Всего оплат',
        accessorFn: (row) =>
          row.wallets.reduce((sum, w) => sum + w.totalPayments, 0) + row.totalPayments,
      },
      {
        header: 'Всего уроков',
        accessorFn: (row) =>
          row.wallets.reduce((sum, w) => sum + w.totalLessons, 0) + row.totalLessons,
      },
      {
        header: 'Баланс уроков',
        accessorFn: (row) => getAggregateBalance(row),
        cell: ({ row }) => {
          const balance = getAggregateBalance(row.original)
          return <span className={balance < 2 ? 'text-destructive' : undefined}>{balance}</span>
        },
      },
      {
        header: 'Родитель',
        accessorFn: (row) =>
          row.parents
            .map((sp) => [sp.parent.firstName, sp.parent.lastName].filter(Boolean).join(' '))
            .join(', ') || '-',
      },
      {
        header: 'Актуальность',
        accessorFn: (row) =>
          row.dataActualizedAt ? formatActualizedDate(row.dataActualizedAt, tz) : '-',
        cell: ({ row }) =>
          row.original.dataActual ? (
            <span>
              {row.original.dataActualizedAt
                ? formatActualizedDate(row.original.dataActualizedAt, tz)
                : 'Да'}
            </span>
          ) : (
            <span className="text-muted-foreground">Не подтверждены</span>
          ),
      },
    ]

    if (canDelete?.success) {
      base.push({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DeleteStudentDialog student={row.original} />
          </div>
        ),
      })
    }

    return base
  }, [canDelete?.success, tz])

  const { globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting } =
    useTableSearchParams()

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      const fullName = getFullName(row.original.firstName, row.original.lastName).toLowerCase()
      return fullName.includes(searchValue)
    },
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      globalFilter,
      pagination,
      sorting,
    },
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError) return <div className="text-destructive">Ошибка загрузки</div>

  return (
    <DataTable
      table={table}
      emptyMessage="Нет учеников."
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
