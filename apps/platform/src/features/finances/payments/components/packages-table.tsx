'use client'

import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Skeleton } from '@repo/ui/components/skeleton'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { filterIds, rangeValues, useClampPage, useTableState } from '@/src/hooks/use-table-state'
import { formatDateOnly } from '@/src/lib/timezone'
import { formatCurrency, getFullName } from '@/src/lib/utils'
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo } from 'react'
import { usePackageListQuery } from '../queries'
import type { PackageListItem } from '../types'
import PeriodFilter, { PERIOD_TITLE } from '@/src/components/period-filter'

/**
 * Числовые колонки. Выключка левая, как у остального, — колонки узкие и заданной
 * ширины, так что разряды и без прижатия вправо стоят почти столбиком. Моноширинные
 * цифры оставлены: без них столбик разъезжается на каждой единице.
 */
const NUMERIC = 'tabular-nums'

/**
 * Ширина всех колонок, кроме «Ученика». Суммы, числа и даты имеют известный потолок
 * длины, и делить между ними лишнее место незачем — весь остаток забирает имя,
 * единственная колонка с `meta.flexible` и без ширины. Оно же и единственное, что
 * реально бывает длинным.
 *
 * Порог горизонтальной прокрутки — сумма `size`: 4 × 130 и 150 у «Ученика»
 * (столько react-table даёт колонке без явного `size`).
 */
const COLUMN_WIDTH = 130

/**
 * Колонки, по которым фильтруем: `useTableState` держит их в URL, а отсюда они
 * уезжают в запрос. Всё строками, включая id менеджера, — значения приходят из
 * адреса, и в числа их превращает уже сборка параметров запроса.
 */
const TABLE_FILTERS = {
  manager: 'string',
  price: 'range',
  lessons: 'range',
} as const

type FilterOption = { label: string; value: string }

function buildColumns(managerOptions: FilterOption[]): ColumnDef<PackageListItem>[] {
  return [
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
      // Деньги раньше количества: на финансовой странице сумма — главная цифра, а
      // занятия объясняют, из чего она сложилась. По сумме же фильтруют.
      id: 'price',
      header: 'Сумма',
      accessorFn: (row) => row.price,
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatCurrency(row.original.price),
      meta: {
        title: 'Сумма',
        className: NUMERIC,
        variant: 'range',
        unit: '₽',
      },
    },
    {
      id: 'lessons',
      header: 'Занятий',
      accessorKey: 'lessonCount',
      size: COLUMN_WIDTH,
      meta: {
        title: 'Занятий',
        className: NUMERIC,
        variant: 'range',
        // Без `unit`: подпись группы и так «Занятий», приписывать «уроков» после
        // полей значило бы сказать то же самое дважды.
      },
    },
    {
      id: 'date',
      header: 'Дата',
      accessorKey: 'date',
      size: COLUMN_WIDTH,
      cell: ({ row }) => formatDateOnly(row.original.date),
      meta: { title: 'Дата', className: NUMERIC },
    },
    {
      id: 'manager',
      header: 'Менеджер',
      accessorFn: (row) => row.manager?.name ?? '',
      size: COLUMN_WIDTH,
      cell: ({ row }) => row.original.manager?.name ?? '—',
      meta: {
        title: 'Менеджер',
        variant: 'multiSelect',
        options: managerOptions,
      },
    },
  ]
}

export default function PackagesTable() {
  const t = useTableState({ id: 'packages', filters: TABLE_FILTERS })
  const { columnFilters, pagination, sorting, period } = t

  // Всё состояние таблицы уезжает в запрос: сервер сам отбирает, сортирует и режет
  // на страницы. Границы независимы — одна без другой значит открытый интервал.
  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: t.search,
      from: period.from ?? undefined,
      to: period.to ?? undefined,
      managerIds: filterIds(columnFilters, 'manager'),
      // Статус из интерфейса убран: все пакеты заводятся оплаченными, и фильтровать
      // не по чему. Параметр у запроса остался — отбор по статусу понадобится, когда
      // счета начнут приходить извне неоплаченными.
      statuses: [],
      priceMin: rangeValues(columnFilters, 'price')[0] ?? null,
      priceMax: rangeValues(columnFilters, 'price')[1] ?? null,
      lessonsMin: rangeValues(columnFilters, 'lessons')[0] ?? null,
      lessonsMax: rangeValues(columnFilters, 'lessons')[1] ?? null,
    }),
    [pagination, sorting, t.search, period, columnFilters],
  )

  const { data, isLoading, isFetching, isError } = usePackageListQuery(params)
  useClampPage(pagination, t.setPagination, data?.total)

  const { data: members = [] } = useMappedMemberListQuery()

  const columns = useMemo(() => buildColumns(members), [members])

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Ключ строки — id пакета, а не её место на странице: по умолчанию react-table
    // нумерует строки индексом, и после перелистывания React переиспользовал бы
    // разметку строки под чужую запись.
    getRowId: (row) => String(row.id),
    // Отбор, порядок и нарезка — в SQL. Клиентские модели строк выключены, поэтому
    // `filterFn` у колонок нет: предикаты живут в `where` серверного экшена.
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    // Иначе пагинации не из чего считать число страниц: она видит только текущую.
    rowCount: data?.total ?? 0,
    onPaginationChange: t.setPagination,
    onColumnFiltersChange: t.setColumnFilters,
    onSortingChange: t.setSorting,
    onColumnVisibilityChange: t.setColumnVisibility,
    state: {
      pagination,
      sorting,
      columnFilters,
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
    return <div className="text-destructive">Ошибка при загрузке пакетов.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет пакетов."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      // Отменённый пакет остаётся в списке следом операции, но читаться должен
      // как погашенный — одного бейджа в широкой строке не видно.
      rowClassName={(row) => (row.original.status === 'CANCELLED' ? 'opacity-55' : undefined)}
      toolbar={
        <DataTableToolbar
          table={table}
          search={t.globalFilter}
          onSearchChange={t.setGlobalFilter}
          searchPlaceholder="Ученик, менеджер, продукт..."
          onReset={t.reset}
          extraFilterTitles={period.from || period.to ? [PERIOD_TITLE] : []}
        >
          <PeriodFilter value={period} onChange={t.setPeriod} />
        </DataTableToolbar>
      }
    />
  )
}
