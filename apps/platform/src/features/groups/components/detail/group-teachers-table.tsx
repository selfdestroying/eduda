'use client'

import BalanceBadge from '@/src/features/lessons/components/balance-badge'
import { useTableState } from '@/src/hooks/use-table-state'
import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'
import type { TeacherGroupWithRate } from '../../types'
import GroupTeacherActions from './group-teachers-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — ставки и бонуса. */
const COLUMN_WIDTH = 130

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Вне компонента: `useHasPermission` мемоизирует по ссылке на объект, и литерал
 * внутри пересчитывал бы проверку на каждый рендер.
 */
const EDIT_PERMISSION = { teacherGroup: ['update'] } as const

function buildColumns(canEdit: boolean): ColumnDef<TeacherGroupWithRate>[] {
  const columns: ColumnDef<TeacherGroupWithRate>[] = [
    {
      id: 'teacher',
      header: 'Преподаватель',
      accessorFn: (row) => row.teacher.name,
      cell: ({ row }) => (
        <Link
          href={`/organization/members/${row.original.teacher.id}`}
          className="text-primary hover:underline"
        >
          {row.original.teacher.name}
        </Link>
      ),
      meta: { title: 'Преподаватель', flexible: true },
      // Строка без преподавателя бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'bid',
      header: 'Ставка',
      accessorFn: (row) => row.rate.bid,
      size: COLUMN_WIDTH,
      cell: ({ row }) => <BalanceBadge balance={row.original.rate.bid} />,
      meta: { title: 'Ставка', className: NUMERIC },
    },
    {
      id: 'bonusPerStudent',
      header: 'Бонус за уч.',
      accessorFn: (row) => row.rate.bonusPerStudent,
      size: COLUMN_WIDTH,
      cell: ({ row }) => <BalanceBadge balance={row.original.rate.bonusPerStudent} />,
      meta: { title: 'Бонус за уч.', className: NUMERIC },
    },
  ]

  if (canEdit) {
    columns.push({
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => <GroupTeacherActions tg={row.original} />,
    })
  }

  return columns
}

/**
 * Преподаватели одной группы: строк единицы, поэтому без пагинации и без похода
 * на сервер — данные уже пришли с карточкой группы.
 */
export default function GroupTeachersTable({
  data,
  isActive,
}: {
  data: TeacherGroupWithRate[]
  isActive?: boolean
}) {
  const canEditGroup = useHasPermission(EDIT_PERMISSION)
  // Правки только у действующей группы: в закрытой состав уже история.
  const canEdit = Boolean(isActive) && canEditGroup
  const t = useTableState({ id: 'group-teachers', prefix: 'gt_' })

  const columns = useMemo(() => buildColumns(canEdit), [canEdit])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => `${row.teacherId}-${row.groupId}`,
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.teacher.name.toLowerCase().includes(String(filterValue).toLowerCase()),
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: {
      globalFilter: t.globalFilter,
      sorting: t.sorting,
      columnVisibility: t.columnVisibility,
    },
  })

  return (
    <DataTable
      table={table}
      emptyMessage="Нет преподавателей."
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Имя преподавателя..."
          onReset={t.reset}
        />
      }
    />
  )
}
