'use client'

import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { useTableState } from '@/src/hooks/use-table-state'
import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import { getAgeFromBirthDate, getFullName } from '@/src/lib/utils'
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
import type { StudentGroupWithStudent } from '../../types'
import GroupStudentActions from './group-students-actions'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Возраст — две цифры. */
const AGE_WIDTH = 90

/** Внешняя ссылка ученика — колонка на одно слово. */
const LINK_WIDTH = 110

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/**
 * Вне компонента: `useHasPermission` мемоизирует по ссылке на объект, и литерал
 * внутри пересчитывал бы проверку на каждый рендер.
 */
const EDIT_PERMISSION = { studentGroup: ['update'] } as const

function buildColumns(canEdit: boolean, tz: string): ColumnDef<StudentGroupWithStudent>[] {
  const columns: ColumnDef<StudentGroupWithStudent>[] = [
    {
      id: 'student',
      header: 'Ученик',
      accessorFn: (row) => getFullName(row.student.firstName, row.student.lastName),
      cell: ({ row }) => (
        <Link
          href={`/students/${row.original.student.id}`}
          className="text-primary hover:underline"
        >
          {getFullName(row.original.student.firstName, row.original.student.lastName)}
        </Link>
      ),
      meta: { title: 'Ученик', flexible: true },
      // Строка без ученика бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'age',
      header: 'Возраст',
      // Возраст не хранится — считается из даты рождения в поясе школы.
      accessorFn: (row) =>
        row.student.birthDate ? getAgeFromBirthDate(row.student.birthDate, tz) : null,
      size: AGE_WIDTH,
      cell: ({ row }) => {
        const { birthDate } = row.original.student
        return birthDate ? getAgeFromBirthDate(birthDate, tz) : '—'
      },
      meta: { title: 'Возраст', className: NUMERIC },
    },
    {
      id: 'link',
      header: 'Ссылка в amo',
      size: LINK_WIDTH,
      enableSorting: false,
      cell: ({ row }) => {
        const url = row.original.student.url
        if (!url) return '—'
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Открыть
          </a>
        )
      },
      meta: { title: 'Ссылка в amo' },
    },
  ]

  if (canEdit) {
    columns.push({
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => <GroupStudentActions sg={row.original} />,
    })
  }

  return columns
}

/**
 * Состав одной группы: строк единицы, поэтому без пагинации и без похода на
 * сервер — данные уже пришли с карточкой группы.
 */
export default function GroupStudentsTable({
  data,
  isActive,
}: {
  data: StudentGroupWithStudent[]
  isActive?: boolean
}) {
  const tz = useOrgTimezone()
  const canEditGroup = useHasPermission(EDIT_PERMISSION)
  // Правки только у действующей группы: в закрытой состав уже история.
  const canEdit = Boolean(isActive) && canEditGroup
  const t = useTableState({ id: 'group-students', prefix: 'gs_' })

  const columns = useMemo(() => buildColumns(canEdit, tz), [canEdit, tz])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => `${row.studentId}-${row.groupId}`,
    globalFilterFn: (row, _columnId, filterValue) =>
      getFullName(row.original.student.firstName, row.original.student.lastName)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase()),
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
      emptyMessage="Нет учеников."
      showColumnVisibility
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Имя ученика..."
          onReset={t.reset}
        />
      }
    />
  )
}
