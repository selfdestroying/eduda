'use client'

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
import type { TeacherLessonRow } from '../types'
import BalanceBadge from './balance-badge'
import { useLessonDetail } from './lesson-detail-context'
import LessonTeacherActions from './lesson-teachers-actions'

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
const EDIT_PERMISSION = { teacherLesson: ['update'] } as const

function buildColumns(canEdit: boolean): ColumnDef<TeacherLessonRow>[] {
  const columns: ColumnDef<TeacherLessonRow>[] = [
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
      accessorKey: 'bid',
      size: COLUMN_WIDTH,
      cell: ({ row }) => <BalanceBadge balance={row.original.bid} />,
      meta: { title: 'Ставка', className: NUMERIC },
    },
    {
      id: 'bonusPerStudent',
      header: 'Бонус за уч.',
      accessorKey: 'bonusPerStudent',
      size: COLUMN_WIDTH,
      cell: ({ row }) => <BalanceBadge balance={row.original.bonusPerStudent} />,
      meta: { title: 'Бонус за уч.', className: NUMERIC },
    },
  ]

  if (canEdit) {
    columns.push({
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => <LessonTeacherActions tl={row.original} />,
    })
  }

  return columns
}

/**
 * Преподаватели одного урока: строк единицы, поэтому без пагинации и без похода
 * на сервер — данные уже пришли с карточкой урока.
 */
export default function LessonTeachersTable() {
  const { lesson } = useLessonDetail()
  const canEdit = useHasPermission(EDIT_PERMISSION)
  const t = useTableState({ id: 'lesson-teachers', prefix: 'lt_' })

  const columns = useMemo(() => buildColumns(canEdit), [canEdit])

  const table = useReactTable({
    data: lesson.teachers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => `${row.teacherId}-${row.lessonId}`,
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
