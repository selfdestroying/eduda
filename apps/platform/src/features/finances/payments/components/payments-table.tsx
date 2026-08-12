'use client'

import { Badge } from '@repo/ui/components/badge'
import DataTable from '@repo/ui/components/data-table'
import { Hint } from '@repo/ui/components/hint'
import { Skeleton } from '@repo/ui/components/skeleton'
import { useColumnVisibility } from '@/src/hooks/use-column-visibility'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { dateToYmd, formatDateOnly, formatDateTimeInTz, ymdToLocalDate } from '@/src/lib/timezone'
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
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import { useMemo } from 'react'
import type { DateRange } from 'react-day-picker'
import { getPaymentKind, PAYMENT_KINDS } from '../constants'
import { usePaymentListQuery } from '../queries'
import type { PaymentListItem } from '../types'
import PaymentActions from './payment-actions'
import PaymentsFilters from './payments-filters'

/** Правая выключка + моноширинные цифры: колонки сумм должны читаться столбиком. */
const NUMERIC = 'text-right tabular-nums'

/**
 * Фильтры, которым не соответствует ни одна колонка таблицы: период уезжает
 * на сервер, вид и сумма отсекаются до неё. `useTableSearchParams` умеет только
 * колоночные, поэтому эти живут в URL сами.
 */
const EXTRA_FILTER_PARSERS = {
  from: parseAsString,
  to: parseAsString,
  kind: parseAsArrayOf(parseAsStringLiteral(PAYMENT_KINDS)).withDefault([]),
  amountMin: parseAsInteger,
  amountMax: parseAsInteger,
}

function buildColumns(tz: string): ColumnDef<PaymentListItem>[] {
  return [
    {
      id: 'student',
      header: 'Ученик',
      // Подпись кошелька уходит второй строкой: она нужна, чтобы отличить два
      // пакета одного ученика, но заголовка колонки не заслуживает.
      accessorFn: (row) => getFullName(row.student.firstName, row.student.lastName),
      cell: ({ row }) => {
        const { student, walletLabel, status, isAdjustment, cancelledAt } = row.original
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/students/${student.id}`}
                className="text-primary truncate hover:underline"
              >
                {getFullName(student.firstName, student.lastName)}
              </Link>
              {/* Пояснение — нативным `title`: `Hint` рисует кнопку в 24px, а
                  бейдж высотой 20px с `overflow-hidden` её обрезает. */}
              {status === 'CANCELLED' && (
                <Badge
                  variant="destructive"
                  title={
                    cancelledAt ? `Отменена ${formatDateTimeInTz(cancelledAt, tz)}` : undefined
                  }
                >
                  Отменена
                </Badge>
              )}
              {isAdjustment && (
                <Badge
                  variant="outline"
                  title="Не оплата, а выравнивание остатка кошелька при переходе на пакеты. Денег за такой записью нет."
                >
                  Корректировка
                </Badge>
              )}
            </div>
            {walletLabel && (
              <span className="text-muted-foreground truncate text-xs" title={walletLabel}>
                {walletLabel}
              </span>
            )}
          </div>
        )
      },
      // Ширину задаём здесь, иначе `truncate` ничего не режет: подпись кошелька
      // из нескольких групп растянула бы колонку и вытолкнула суммы за экран.
      meta: { title: 'Ученик', className: 'max-w-64' },
      // Строка без ученика бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      id: 'lessons',
      header: () => (
        <span className="flex items-center gap-0.5">
          Занятий
          <Hint text="Сколько уроков зачислено на баланс кошелька этой оплатой и сколько из них ещё не потрачено." />
        </span>
      ),
      accessorFn: (row) => row.lessonCount,
      cell: ({ row }) => {
        const { lessonCount, remaining, status } = row.original
        return (
          <div className="flex flex-col">
            <span>{lessonCount}</span>
            {/* `null` — пакет до разметки остатков, врать «осталось 0» нельзя.
                У отменённой оплаты остаток обнулён самой отменой, и «потрачен»
                там означало бы, что уроки отходили, — а их сняли с баланса. */}
            {remaining !== null && status !== 'CANCELLED' && (
              <span className="text-muted-foreground text-xs">
                {remaining > 0 ? `осталось ${remaining}` : 'потрачен'}
              </span>
            )}
          </div>
        )
      },
      meta: { title: 'Занятий', className: NUMERIC },
    },
    {
      id: 'price',
      header: 'Сумма',
      accessorFn: (row) => row.price,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{formatCurrency(row.original.price)}</span>
          <span className="text-muted-foreground text-xs">
            {formatCurrency(row.original.bidForLesson)} / занятие
          </span>
        </div>
      ),
      meta: { title: 'Сумма', className: NUMERIC },
    },
    {
      id: 'date',
      header: 'Дата',
      accessorKey: 'date',
      cell: ({ row }) => formatDateOnly(row.original.date),
      meta: { title: 'Дата', className: 'whitespace-nowrap' },
    },
    {
      id: 'paymentMethod',
      header: 'Метод',
      accessorFn: (row) => row.paymentMethod?.name ?? '',
      cell: ({ row }) => row.original.paymentMethod?.name ?? '—',
      meta: { title: 'Метод оплаты' },
      filterFn: (row, _id, selectedIds: number[]) =>
        selectedIds.length === 0 || selectedIds.includes(row.original.paymentMethod?.id ?? -1),
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
      meta: { title: 'Менеджер' },
      filterFn: (row, _id, selectedIds: number[]) =>
        selectedIds.length === 0 || selectedIds.includes(row.original.manager?.id ?? -1),
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => <PaymentActions payment={row.original} />,
    },
  ]
}

export default function PaymentsTable() {
  const tz = useOrgTimezone()

  const {
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    sorting,
    setSorting,
  } = useTableSearchParams({ filters: { paymentMethod: 'integer', manager: 'integer' } })

  // Период уезжает на сервер, поэтому живёт отдельно от фильтров таблицы.
  // Вид и сумма — тоже отдельно: колонок под них нет, а заводить их ради
  // `filterFn` значило бы держать в таблице две пустые колонки.
  const [{ from, to, kind, amountMin, amountMax }, setExtraFilters] = useQueryStates(
    EXTRA_FILTER_PARSERS,
    { shallow: true, history: 'replace' },
  )

  // nuqs отдаёт `null` для незаданного параметра, схема экшена ждёт `undefined`.
  // Незакрытый диапазон (кликнули одну дату из двух) сжимаем в этот же день:
  // на кнопке написано «5 мар», и выборка обязана этому соответствовать —
  // иначе серверный дефолт растянул бы её до конца текущего месяца.
  const {
    data: payments = [],
    isLoading,
    isError,
  } = usePaymentListQuery({ from: from ?? undefined, to: to ?? from ?? undefined })
  const { columnVisibility, setColumnVisibility } = useColumnVisibility('payments')

  const rows = useMemo(
    () =>
      payments.filter((p) => {
        if (kind.length > 0 && !kind.includes(getPaymentKind(p))) return false
        if (amountMin !== null && p.price < amountMin) return false
        if (amountMax !== null && p.price > amountMax) return false
        return true
      }),
    [payments, kind, amountMin, amountMax],
  )

  const columns = useMemo(() => buildColumns(tz), [tz])

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
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    // Поиск идёт по тому, что человек видит в строке: ученик, менеджер, метод.
    globalFilterFn: (row, _columnId, filterValue) => {
      const needle = String(filterValue).trim().toLowerCase()
      if (!needle) return true
      const { student, manager, paymentMethod, walletLabel } = row.original
      return [
        getFullName(student.firstName, student.lastName),
        manager?.name,
        paymentMethod?.name,
        walletLabel,
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

  const setExtra = (values: Partial<Record<keyof typeof EXTRA_FILTER_PARSERS, unknown>>) => {
    setExtraFilters(values as Parameters<typeof setExtraFilters>[0])
    resetPage()
  }

  const setFilters: typeof setColumnFilters = (updater) => {
    setColumnFilters(updater)
    resetPage()
  }

  const period: DateRange | undefined = from
    ? { from: ymdToLocalDate(from), to: to ? ymdToLocalDate(to) : undefined }
    : undefined

  const setPeriod = (range: DateRange | undefined) =>
    setExtra({
      from: range?.from ? dateToYmd(range.from) : null,
      to: range?.to ? dateToYmd(range.to) : null,
    })

  const hasActiveFilters =
    Boolean(from) ||
    Boolean(to) ||
    Boolean(globalFilter) ||
    kind.length > 0 ||
    amountMin !== null ||
    amountMax !== null ||
    columnFilters.length > 0

  const resetFilters = () => {
    setExtra({ from: null, to: null, kind: null, amountMin: null, amountMax: null })
    setGlobalFilter('')
    setColumnFilters([])
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
        <PaymentsFilters
          search={globalFilter}
          onSearchChange={setGlobalFilter}
          period={period}
          onPeriodChange={setPeriod}
          columnFilters={columnFilters}
          setColumnFilters={setFilters}
          kind={kind}
          onKindChange={(values) => setExtra({ kind: values.length > 0 ? values : null })}
          amountMin={amountMin}
          amountMax={amountMax}
          onAmountMinChange={(value) => setExtra({ amountMin: value })}
          onAmountMaxChange={(value) => setExtra({ amountMax: value })}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />
      }
    />
  )
}
