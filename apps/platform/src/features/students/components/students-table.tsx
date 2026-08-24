'use client'

import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { useClampPage, useTableState } from '@/src/hooks/use-table-state'
import { useHasPermission } from '@/src/lib/permissions/use-has-permission'
import { formatDateTimeInTz } from '@/src/lib/timezone'
import { getAgeFromBirthDate, getFullName } from '@/src/lib/utils'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Hint } from '@repo/ui/components/hint'
import { Skeleton } from '@repo/ui/components/skeleton'
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'
import { useStudentListQuery } from '../queries'
import type { StudentListItem } from '../types'
import DeleteStudentDialog from './detail/delete-student-dialog'

/** Числовые колонки. Моноширинные цифры — иначе столбик разъезжается. */
const NUMERIC = 'tabular-nums'

/** Ширина колонок с известным потолком длины — чисел и дат. */
const COLUMN_WIDTH = 130

/** Возраст — две цифры. */
const AGE_WIDTH = 90

/** Меню строки — иконка и ничего больше. */
const ACTIONS_WIDTH = 56

/** Баланс ниже этого — ученику скоро потребуется оплата, и его видно красным. */
const LOW_BALANCE = 2

/**
 * Вне компонента: `useHasPermission` мемоизирует по ссылке на объект, и литерал
 * внутри пересчитывал бы проверку на каждый рендер.
 */
const DELETE_PERMISSION = { student: ['delete'] } as const

/**
 * Итог по ученику — его собственный остаток плюс все кошельки. Собственные
 * колонки остались с тех пор, когда кошельков не было; у старых учеников там
 * лежат уроки, которых больше нигде нет.
 */
function walletTotal(
  row: StudentListItem,
  field: 'lessonsBalance' | 'totalLessons' | 'totalPayments',
) {
  return row.wallets.reduce((sum, w) => sum + w[field], 0) + row[field]
}

function buildColumns(canDelete: boolean, tz: string): ColumnDef<StudentListItem>[] {
  const columns: ColumnDef<StudentListItem>[] = [
    {
      id: 'student',
      header: 'Имя',
      accessorFn: (row) => getFullName(row.firstName, row.lastName),
      cell: ({ row }) => (
        <Link href={`/students/${row.original.id}`} className="text-primary hover:underline">
          {getFullName(row.original.firstName, row.original.lastName)}
        </Link>
      ),
      meta: { title: 'Имя', flexible: true },
      // Строка без имени бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'age',
      header: 'Возраст',
      // Возраст не хранится: считаем из даты рождения в поясе школы. Сортировка
      // при этом идёт по `birthDate` на сервере — по числу, а не по строке.
      accessorFn: (row) => (row.birthDate ? getAgeFromBirthDate(row.birthDate, tz) : null),
      size: AGE_WIDTH,
      cell: ({ row }) =>
        row.original.birthDate ? getAgeFromBirthDate(row.original.birthDate, tz) : '—',
      meta: { title: 'Возраст', className: NUMERIC },
    },
    {
      id: 'totalPayments',
      header: 'Всего оплат',
      accessorFn: (row) => walletTotal(row, 'totalPayments'),
      size: COLUMN_WIDTH,
      // Сортировка выключена: в строке это сумма по ученику и всем его кошелькам,
      // и SQL такую по столбцу не отсортирует — порядок врал бы.
      enableSorting: false,
      meta: { title: 'Всего оплат', className: NUMERIC },
    },
    {
      id: 'totalLessons',
      header: 'Всего уроков',
      accessorFn: (row) => walletTotal(row, 'totalLessons'),
      size: COLUMN_WIDTH,
      enableSorting: false,
      meta: { title: 'Всего уроков', className: NUMERIC },
    },
    {
      id: 'lessonsBalance',
      header: () => (
        <span className="flex items-center gap-0.5">
          Баланс уроков
          <Hint text="Оставшееся количество оплаченных уроков по всем кошелькам. Красным выделяются ученики с балансом менее 2 - им скоро потребуется оплата." />
        </span>
      ),
      accessorFn: (row) => walletTotal(row, 'lessonsBalance'),
      size: COLUMN_WIDTH,
      enableSorting: false,
      cell: ({ row }) => {
        const balance = walletTotal(row.original, 'lessonsBalance')
        return (
          <span className={balance < LOW_BALANCE ? 'text-destructive' : undefined}>{balance}</span>
        )
      },
      meta: { title: 'Баланс уроков', className: NUMERIC },
    },
    {
      id: 'parent',
      header: 'Родитель',
      accessorFn: (row) =>
        row.parents
          .map((sp) => [sp.parent.firstName, sp.parent.lastName].filter(Boolean).join(' '))
          .join(', '),
      cell: ({ row }) =>
        row.original.parents
          .map((sp) => [sp.parent.firstName, sp.parent.lastName].filter(Boolean).join(' '))
          .join(', ') || '—',
      // Родителей у ученика несколько — сортировать по списку имён нечего.
      enableSorting: false,
      meta: { title: 'Родитель', flexible: true },
    },
    {
      // Актуальность — это дата последней правки анкеты, а не флаг: подтверждать
      // данные родителю больше не нужно.
      id: 'dataActualizedAt',
      header: 'Данные обновлены',
      accessorKey: 'dataActualizedAt',
      size: COLUMN_WIDTH,
      cell: ({ row }) =>
        row.original.dataActualizedAt ? (
          <span>
            {formatDateTimeInTz(row.original.dataActualizedAt, tz, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        ) : (
          <span className="text-muted-foreground">Не менялись</span>
        ),
      meta: { title: 'Данные обновлены', className: NUMERIC },
    },
  ]

  if (canDelete) {
    columns.push({
      id: 'actions',
      header: () => null,
      size: ACTIONS_WIDTH,
      enableHiding: false,
      cell: ({ row }) => (
        // Гасим всплытие здесь, а не в ячейке: диалог удаления не должен
        // срабатывать заодно с переходом по строке.
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <DeleteStudentDialog student={row.original} />
        </div>
      ),
    })
  }

  return columns
}

export default function StudentsTable() {
  const t = useTableState({ id: 'students' })
  const { pagination, sorting } = t
  const tz = useOrgTimezone()
  const canDelete = useHasPermission(DELETE_PERMISSION)

  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: t.search,
    }),
    [pagination, sorting, t.search],
  )

  const { data, isLoading, isFetching, isError } = useStudentListQuery(params)
  useClampPage(pagination, t.setPagination, data?.total)

  const columns = useMemo(() => buildColumns(canDelete, tz), [canDelete, tz])

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Ключ строки — id ученика, а не её место на странице: иначе после
    // перелистывания React переиспользует разметку под чужую запись.
    getRowId: (row) => String(row.id),
    // Отбор, порядок и нарезка — в SQL.
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    // Иначе пагинации не из чего считать число страниц: она видит только текущую.
    rowCount: data?.total ?? 0,
    onPaginationChange: t.setPagination,
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: { pagination, sorting, columnVisibility: t.columnVisibility },
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
    return <div className="text-destructive">Ошибка при загрузке учеников.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет учеников."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Ученик или родитель..."
          onReset={t.reset}
        />
      }
    />
  )
}
