'use client'

import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Hint } from '@repo/ui/components/hint'
import { Skeleton } from '@repo/ui/components/skeleton'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { useColumnVisibility } from '@/src/hooks/use-column-visibility'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatDateOnly } from '@/src/lib/timezone'
import { formatCurrency, getFullName } from '@/src/lib/utils'
import {
  type ColumnDef,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { parseAsString, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { useActivePaymentMethodListQuery } from '../../payment-methods/queries'
import {
  getPaymentKind,
  PAYMENT_KIND_BADGE,
  PAYMENT_KIND_LABELS,
  PAYMENT_KIND_OPTIONS,
} from '../constants'
import { usePaymentListQuery } from '../queries'
import type { PaymentListItem } from '../types'
import PaymentActions from './payment-actions'

/** Правая выключка + моноширинные цифры: колонки сумм должны читаться столбиком. */
const NUMERIC = 'text-right tabular-nums'

/**
 * Ширины колонок. Таблица растянута на `w-full`, поэтому это пропорции, а не
 * пиксели: браузер распределяет излишек. Заданы, потому что дефолт react-table —
 * 150 на каждую, то есть все колонки одинаковые, а «Ученик» и «⋮» одинаковыми
 * быть не должны.
 */
const WIDTHS = {
  student: 220,
  lessons: 90,
  price: 110,
  date: 100,
  paymentMethod: 130,
  manager: 140,
  kind: 120,
  actions: 48,
} as const

/**
 * Период. Контрола под него сейчас нет — пикер сняли, его переделывают, — но
 * параметры читаются и уезжают в запрос: без них таблица была бы наглухо заперта
 * в текущем месяце (серверный дефолт), и до прошлых оплат не добраться совсем.
 * Остальные фильтры описаны в `meta` своих колонок, тулбар собирает их оттуда.
 */
const PERIOD_PARSERS = { from: parseAsString, to: parseAsString }

/** Колонки, по которым фильтруем: `useTableSearchParams` держит их в URL. */
const TABLE_FILTERS = {
  paymentMethod: 'string',
  manager: 'string',
  kind: 'string',
  price: 'range',
} as const

type FilterOption = { label: string; value: string }

function buildColumns(
  methodOptions: FilterOption[],
  managerOptions: FilterOption[],
): ColumnDef<PaymentListItem>[] {
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
      size: WIDTHS.student,
      meta: { title: 'Ученик' },
      // Строка без ученика бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'lessons',
      header: () => (
        <span className="flex items-center gap-0.5">
          Занятий
          <Hint text="Сколько уроков зачислено на баланс кошелька этой оплатой." />
        </span>
      ),
      accessorKey: 'lessonCount',
      size: WIDTHS.lessons,
      meta: { title: 'Занятий', className: NUMERIC },
    },
    {
      id: 'price',
      header: 'Сумма',
      accessorFn: (row) => row.price,
      cell: ({ row }) => formatCurrency(row.original.price),
      size: WIDTHS.price,
      meta: { title: 'Сумма', className: NUMERIC, variant: 'range', unit: '₽' },
      filterFn: (row, _id, [min, max]: [number?, number?]) => {
        const price = row.original.price
        if (min !== undefined && price < min) return false
        if (max !== undefined && price > max) return false
        return true
      },
    },
    {
      id: 'date',
      header: 'Дата',
      accessorKey: 'date',
      cell: ({ row }) => formatDateOnly(row.original.date),
      size: WIDTHS.date,
      meta: { title: 'Дата' },
    },
    {
      id: 'paymentMethod',
      header: 'Метод',
      accessorFn: (row) => row.paymentMethod?.name ?? '',
      cell: ({ row }) => row.original.paymentMethod?.name ?? '—',
      size: WIDTHS.paymentMethod,
      meta: { title: 'Метод оплаты', variant: 'multiSelect', options: methodOptions },
      // Сравниваем строками: значения фильтров приезжают из URL и остаются ими.
      filterFn: (row, _id, selected: string[]) =>
        selected.length === 0 || selected.includes(String(row.original.paymentMethod?.id)),
    },
    {
      id: 'manager',
      header: () => (
        <span className="flex items-center gap-0.5">
          Менеджер
          <Hint text="Кто продал этот пакет. У оплат, заведённых до появления поля, менеджер не указан." />
        </span>
      ),
      accessorFn: (row) => row.manager?.name ?? '',
      cell: ({ row }) => row.original.manager?.name ?? '—',
      size: WIDTHS.manager,
      meta: { title: 'Менеджер', variant: 'multiSelect', options: managerOptions },
      filterFn: (row, _id, selected: string[]) =>
        selected.length === 0 || selected.includes(String(row.original.manager?.id)),
    },
    {
      // id остался `kind` — по нему уже записаны фильтр в URL и видимость в
      // localStorage, переименование в `status` их обнулило бы.
      id: 'kind',
      header: 'Статус',
      // Сортируем по видимой подписи, а не по внутреннему ключу.
      accessorFn: (row) => PAYMENT_KIND_LABELS[getPaymentKind(row)],
      cell: ({ row }) => {
        const kind = getPaymentKind(row.original)
        return <Badge variant={PAYMENT_KIND_BADGE[kind]}>{PAYMENT_KIND_LABELS[kind]}</Badge>
      },
      size: WIDTHS.kind,
      meta: { title: 'Статус', variant: 'multiSelect', options: PAYMENT_KIND_OPTIONS },
      filterFn: (row, _id, selected: string[]) =>
        selected.length === 0 || selected.includes(getPaymentKind(row.original)),
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => <PaymentActions payment={row.original} />,
      size: WIDTHS.actions,
      // Без вертикального отступа: иконка-кнопка и так 28px со своей областью
      // нажатия, а с `p-2` ячейки она вытягивала строку до 44px. У отменённой
      // оплаты действий нет, и та же строка выходила 36px — теперь высоту всюду
      // задаёт бейдж статуса, а не наличие кнопки.
      meta: { className: 'px-2 py-0' },
    },
  ]
}

export default function PaymentsTable() {
  const {
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    sorting,
    setSorting,
  } = useTableSearchParams({ filters: TABLE_FILTERS })

  const [{ from, to }, setPeriodValues] = useQueryStates(PERIOD_PARSERS, {
    shallow: true,
    history: 'replace',
  })

  // nuqs отдаёт `null` для незаданного параметра, схема экшена ждёт `undefined`.
  // `from` без `to` — это один день, а не «от даты и далее»: иначе серверный
  // дефолт дотянул бы верхнюю границу до конца текущего месяца.
  const {
    data: payments = [],
    isLoading,
    isError,
  } = usePaymentListQuery({ from: from ?? undefined, to: to ?? from ?? undefined })

  const { data: paymentMethods = [] } = useActivePaymentMethodListQuery()
  const { data: members = [] } = useMappedMemberListQuery()
  const { columnVisibility, setColumnVisibility } = useColumnVisibility('payments')

  const methodOptions = useMemo(
    () => paymentMethods.map((m) => ({ value: String(m.id), label: m.name })),
    [paymentMethods],
  )

  const columns = useMemo(() => buildColumns(methodOptions, members), [methodOptions, members])

  // Колонки переименовали (`lessonCount` → `lessons` и т.д.), а `sort` живёт в
  // адресе — по старым ссылкам и из истории браузера приезжает id, которого уже
  // нет. Сортировать по нему react-table всё равно не станет, только ругнётся в
  // консоль на каждый рендер; выкидываем сами.
  const safeSorting = useMemo(() => {
    // id колонки — либо явный, либо `accessorKey`: у колонки, объявленной вторым
    // способом, `c.id` пуст, и брать только его значило бы вычеркнуть её из
    // разрешённых и тихо сломать ей сортировку.
    const ids = new Set(
      columns.map((c) => c.id ?? ('accessorKey' in c ? String(c.accessorKey) : undefined)),
    )
    return sorting.filter((s) => ids.has(s.id))
  }, [sorting, columns])

  const table = useReactTable({
    data: payments,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    // Ровно по тому, что видно в строке: ученик, менеджер, метод. Совпадение по
    // невидимому полю выглядит как случайно попавшая строка.
    globalFilterFn: (row, _columnId, filterValue) => {
      const needle = String(filterValue).trim().toLowerCase()
      if (!needle) return true
      const { student, manager, paymentMethod } = row.original
      return [
        getFullName(student.firstName, student.lastName),
        manager?.name,
        paymentMethod?.name,
      ].some((field) => field?.toLowerCase().includes(needle))
    },
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: { pagination, sorting: safeSorting, globalFilter, columnFilters, columnVisibility },
  })

  // Любая смена фильтра возвращает на первую страницу: иначе отбор в пять строк,
  // сделанный со страницы четыре, показывает пустую таблицу и «Страница 4 из 1».
  // `setGlobalFilter` это делает сам, остальные сеттеры — нет.
  const resetPage = () => setPagination({ ...pagination, pageIndex: 0 })

  const resetFilters = () => {
    setPeriodValues({ from: null, to: null })
    setGlobalFilter('')
    setColumnFilters([])
    resetPage()
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
    return <div className="text-destructive">Ошибка при загрузке оплат.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет оплат."
      showPagination
      showColumnVisibility
      // Отменённая оплата остаётся в списке следом операции, но читаться должна
      // как погашенная — одного бейджа в широкой строке не видно.
      rowClassName={(row) => (row.original.status === 'CANCELLED' ? 'opacity-55' : undefined)}
      toolbar={
        <DataTableToolbar
          table={table}
          search={globalFilter}
          onSearchChange={setGlobalFilter}
          searchPlaceholder="Ученик, менеджер, метод..."
          onReset={resetFilters}
          hasExtraFilters={Boolean(from) || Boolean(to)}
        />
      }
    />
  )
}
