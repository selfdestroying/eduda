'use client'

import { memberRoleLabels } from '@/src/components/sidebar/nav-user'
import { useTableState } from '@/src/hooks/use-table-state'
import { OrganizationRole } from '@/src/lib/auth/server'
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
import Link from 'next/link'
import { useMemberListQuery } from '../queries'
import type { MemberWithUser } from '../types'
import MemberActions from './member-actions'

/** Ширина колонок с известным потолком длины — роли и статуса. */
const COLUMN_WIDTH = 130

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Колонки, по которым фильтруем. Отбор клиентский, поэтому у колонки есть свой
 * `filterFn`: он сверяет роль со списком строк, приходящим из тулбара.
 */
const TABLE_FILTERS = { role: 'string' } as const

const ROLE_OPTIONS = [
  { label: 'Учитель', value: 'teacher' },
  { label: 'Менеджер', value: 'manager' },
  { label: 'Владелец', value: 'owner' },
]

const columns: ColumnDef<MemberWithUser>[] = [
  {
    id: 'user',
    header: 'Полное имя',
    accessorFn: (row) => row.user.name,
    cell: ({ row }) => (
      <Link
        href={`/organization/members/${row.original.userId}`}
        className="text-primary hover:underline"
      >
        {row.original.user.name}
      </Link>
    ),
    meta: { title: 'Полное имя', flexible: true },
    // Строка без имени бессмысленна — прятать нечего.
    enableHiding: false,
  },
  {
    id: 'role',
    header: 'Роль',
    accessorKey: 'role',
    size: COLUMN_WIDTH,
    cell: ({ row }) => memberRoleLabels[row.original.role as OrganizationRole] ?? row.original.role,
    filterFn: (row, _id, filterValue) => {
      const selected = filterValue as string[]
      return selected.length === 0 || selected.includes(row.original.role)
    },
    meta: { title: 'Роль', variant: 'multiSelect', options: ROLE_OPTIONS },
  },
  {
    id: 'status',
    header: 'Статус',
    accessorFn: (row) => (row.user.banned ? 'Неактивен' : 'Активен'),
    size: COLUMN_WIDTH,
    cell: ({ row }) => (
      <span className={row.original.user.banned ? 'text-destructive' : 'text-success'}>
        {row.original.user.banned ? 'Неактивен' : 'Активен'}
      </span>
    ),
    meta: { title: 'Статус' },
  },
  {
    id: 'actions',
    header: () => null,
    size: ACTIONS_WIDTH,
    enableHiding: false,
    cell: ({ row }) => <MemberActions member={row.original} />,
  },
]

/** Сотрудники школы: их десятки, отбор и нарезка остаются на клиенте. */
export default function MembersTable() {
  const { data: members = [], isLoading, isError } = useMemberListQuery()
  const t = useTableState({ id: 'members', filters: TABLE_FILTERS })

  const table = useReactTable({
    data: members,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.userId),
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.user.name.toLowerCase().includes(String(filterValue).toLowerCase()),
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
    return <div className="text-destructive">Ошибка при загрузке сотрудников.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет пользователей."
      showPagination
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Имя сотрудника..."
          onReset={t.reset}
        />
      }
    />
  )
}
