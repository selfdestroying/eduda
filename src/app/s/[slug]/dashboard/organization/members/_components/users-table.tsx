'use client'
import DataTable from '@/src/components/data-table'
import TableFilter from '@/src/components/table-filter'
import {
  ColumnDef,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { Prisma } from '@/prisma/generated/client'
import { memberRoleLabels } from '@/src/components/sidebar/nav-user'
import { Input } from '@/src/components/ui/input'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { OrganizationRole } from '@/src/lib/auth'
import Link from 'next/link'
import { useMemo } from 'react'
import UsersActions from './users-actions'

interface UsersTableProps {
  data: Prisma.MemberGetPayload<{ include: { user: true } }>[]
}

const columns: ColumnDef<Prisma.MemberGetPayload<{ include: { user: true } }>>[] = [
  {
    id: 'user',
    header: 'Полное имя',
    accessorFn: (value) => value.userId,
    cell: ({ row }) => (
      <Link
        href={`/dashboard/organization/members/${row.original.userId}`}
        className="text-primary hover:underline"
      >
        {row.original.user.name}
      </Link>
    ),
  },
  {
    id: 'role',
    header: 'Роль',
    accessorFn: (value) => value.role,
    cell: ({ row }) => memberRoleLabels[row.original.role as OrganizationRole],
    filterFn: (row, id, filterValue) => {
      return filterValue.length === 0 || filterValue.includes(row.original.role)
    },
  },
  {
    header: 'Ставки',
    cell: ({ row }) => {
      const { bidForLesson, bidForIndividual, bonusPerStudent } = row.original.user
      const parts = [
        `${bidForLesson?.toLocaleString() ?? '-'}`,
        `${bidForIndividual?.toLocaleString() ?? '-'}`,
        `${bonusPerStudent?.toLocaleString() ?? '0'}`,
      ]
      return (
        <span
          className="text-xs tabular-nums"
          title={`Группа: ${parts[0]} ₽ / Индив: ${parts[1]} ₽ / Бонус: ${parts[2]} ₽`}
        >
          {parts[0]} / {parts[1]} / {parts[2]} ₽
        </span>
      )
    },
  },
  {
    header: 'Статус',
    accessorKey: 'status',
    cell: ({ row }) => (
      <span className={row.original.user.banned ? 'text-destructive' : 'text-success'}>
        {row.original.user.banned ? 'Неактивен' : 'Активен'}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <UsersActions member={row.original} />,
  },
]

const mappedRoles = [
  { label: 'Учитель', value: 'teacher' },
  { label: 'Менеджер', value: 'manager' },
]

export default function UsersTable({ data }: UsersTableProps) {
  const { columnFilters, setColumnFilters, globalFilter, setGlobalFilter, sorting, setSorting } =
    useTableSearchParams({
      filters: { role: 'string' },
      search: true,
      sorting: true,
    })

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      const fullName = row.original.user.name.toLowerCase()
      const roleName = row.original.role ? row.original.role.toLowerCase() : ''
      return fullName.includes(searchValue) || roleName.includes(searchValue)
    },
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      columnFilters,
      globalFilter,
      sorting,
    },
  })

  const handleRoleFilterChange = (selectedRoles: { label: string; value: string }[]) => {
    const roleIds = selectedRoles.map((role) => role.value)
    setColumnFilters((old) => {
      const otherFilters = old.filter((filter) => filter.id !== 'role')
      if (roleIds.length === 0) {
        return otherFilters
      }
      return [...otherFilters, { id: 'role', value: roleIds }]
    })
  }

  const selectedRoles = useMemo(() => {
    const filter = columnFilters.find((f) => f.id === 'role')
    if (!filter) return []
    const ids = filter.value as string[]
    return mappedRoles.filter((r) => ids.includes(r.value))
  }, [columnFilters])

  return (
    <DataTable
      table={table}
      emptyMessage="Нет пользователей."
      toolbar={
        <div className="flex flex-col items-end gap-2 md:flex-row">
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Поиск..."
          />
          <TableFilter
            items={mappedRoles}
            label="Роль"
            value={selectedRoles}
            onChange={handleRoleFilterChange}
          />
        </div>
      }
    />
  )
}
