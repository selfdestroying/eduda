'use client'
import { Prisma } from '@/prisma/generated/client'
import DataTable from '@/src/components/data-table'
import { Input } from '@/src/components/ui/input'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
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

type StudentWithGroups = Prisma.StudentGetPayload<{ include: { groups: true } }>

function getAggregateBalance(student: StudentWithGroups) {
  return student.groups.reduce((sum, sg) => sum + sg.lessonsBalance, 0) + student.lessonsBalance
}

const columns: ColumnDef<StudentWithGroups>[] = [
  {
    header: 'Имя',
    accessorFn: (value) => value.id,
    cell: ({ row }) => (
      <Link
        href={`/dashboard/students/${row.original.id}`}
        className="text-primary hover:underline"
      >
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
      row.groups.reduce((sum, sg) => sum + sg.totalPayments, 0) + row.totalPayments,
  },
  {
    header: 'Всего уроков',
    accessorFn: (row) =>
      row.groups.reduce((sum, sg) => sum + sg.totalLessons, 0) + row.totalLessons,
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
    header: 'Имя родителя',
    accessorKey: 'parentsName',
  },
  {
    header: 'Логин',
    accessorKey: 'login',
  },
  {
    header: 'Пароль',
    accessorKey: 'password',
  },
  {
    header: 'Коины',
    accessorKey: 'coins',
  },
]

export default function StudentsTable({ data }: { data: StudentWithGroups[] }) {
  const { globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting } =
    useTableSearchParams({
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
