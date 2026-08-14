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
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import Link from 'next/link'
import { parseAsString, useQueryStates } from 'nuqs'
import { useEffect, useMemo } from 'react'
import { useActivePaymentMethodListQuery } from '../../payment-methods/queries'
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
  type PaymentStatusValue,
} from '../constants'
import { usePaymentListQuery } from '../queries'
import type { PaymentListItem } from '../types'
import PaymentActions from './payment-actions'

/**
 * Цифры — по правому краю и моноширинными: только так разряды встают в столбик и
 * значения можно сравнивать взглядом. Текстовые колонки остаются по левому краю.
 */
const NUMERIC = 'text-right tabular-nums'

/**
 * Ширины — в процентах, у видимых по умолчанию в сумме 100. Проценты, а не пиксели,
 * потому что при пикселях излишек надо куда-то девать: отдашь одной колонке —
 * раздуется она, поделишь на все — раздуются все.
 *
 * Классы, а не `style`, потому что инлайновую ширину пишет сам `DataTable`;
 * `meta.flexible` её отключает, оставляя ширину этим классам. Значения обязаны
 * быть литералами — Tailwind ищет их в исходнике, из переменной класс не родится.
 */
const W = {
  student: 'w-[20%]',
  price: 'w-[10%]',
  lessons: 'w-[12%]',
  status: 'w-[14%]',
  date: 'w-[11%]',
  paymentMethod: 'w-[14%]',
  manager: 'w-[14%]',
  actions: 'w-[5%]',
} as const

/**
 * Минимальные ширины в пикселях. Раскладку задают проценты выше; здесь — только
 * порог, ниже которого таблица уходит в горизонтальную прокрутку. Поэтому числа
 * не «сколько хочется», а «уже нечитаемо».
 *
 * Порог — их сумма, но каждой колонке на этой ширине достаётся только её процент.
 * Значит число здесь соблюдается лишь пока `пиксели / доля <= сумма`; где это не
 * так, колонка у порога окажется уже заявленного минимума.
 */
const WIDTHS = {
  student: 120,
  price: 120,
  lessons: 50,
  status: 130,
  date: 110,
  paymentMethod: 150,
  manager: 150,
  actions: 50,
} as const

/**
 * Период. Контрола под него сейчас нет — пикер сняли, его переделывают, — но
 * параметры читаются и уезжают в запрос, так что period по ссылке работает.
 * Без них выборка не ограничена по дате: страницу режет сервер, и вся история
 * стоит столько же, сколько один месяц.
 */
const PERIOD_PARSERS = { from: parseAsString, to: parseAsString }

/**
 * Колонки, по которым фильтруем: `useTableSearchParams` держит их в URL, а отсюда
 * они уезжают в запрос. Всё строками, включая id метода и менеджера, — значения
 * приходят из адреса, и в числа их превращает уже сборка параметров запроса.
 */
const TABLE_FILTERS = {
  paymentMethod: 'string',
  manager: 'string',
  status: 'string',
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
      meta: { title: 'Ученик', flexible: true, className: W.student },
      // Строка без ученика бессмысленна — прятать нечего.
      enableHiding: false,
    },
    {
      // Деньги раньше количества: на финансовой странице сумма — главная цифра, а
      // занятия объясняют, из чего она сложилась. По сумме же фильтруют.
      id: 'price',
      header: 'Сумма',
      accessorFn: (row) => row.price,
      cell: ({ row }) => formatCurrency(row.original.price),
      size: WIDTHS.price,
      meta: {
        title: 'Сумма',
        flexible: true,
        className: `${NUMERIC} ${W.price}`,
        variant: 'range',
        unit: '₽',
        // Шкала объявлена, а не выведена из данных: при серверной пагинации клиент
        // видит одну страницу и настоящих min/max не знает. Верх подобран под
        // типичный пакет; что дороже — вводится числом в поле рядом.
        range: [0, 20_000],
        step: 500,
      },
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
      meta: { title: 'Занятий', flexible: true, className: `${NUMERIC} ${W.lessons}` },
    },
    {
      id: 'status',
      header: 'Статус',
      accessorKey: 'status',
      cell: ({ row }) => {
        const status = row.original.status as PaymentStatusValue
        return <Badge variant={PAYMENT_STATUS_BADGE[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>
      },
      size: WIDTHS.status,
      meta: {
        title: 'Статус',
        flexible: true,
        className: W.status,
        variant: 'multiSelect',
        options: PAYMENT_STATUS_OPTIONS,
      },
    },
    {
      id: 'date',
      header: 'Дата',
      accessorKey: 'date',
      cell: ({ row }) => formatDateOnly(row.original.date),
      size: WIDTHS.date,
      meta: { title: 'Дата', flexible: true, className: W.date },
    },
    {
      id: 'paymentMethod',
      header: 'Метод',
      accessorFn: (row) => row.paymentMethod?.name ?? '',
      cell: ({ row }) => row.original.paymentMethod?.name ?? '—',
      size: WIDTHS.paymentMethod,
      meta: {
        title: 'Метод оплаты',
        flexible: true,
        className: W.paymentMethod,
        variant: 'multiSelect',
        options: methodOptions,
      },
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
      meta: {
        title: 'Менеджер',
        flexible: true,
        className: W.manager,
        variant: 'multiSelect',
        options: managerOptions,
      },
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => <PaymentActions payment={row.original} />,
      size: WIDTHS.actions,
      // Без вертикального отступа: иконка-кнопка и так 28px со своей областью
      // нажатия, а с `p-2` ячейки она вытягивала строку до 44px. У отменённой
      // оплаты действий нет, и та же строка выходила ниже — теперь высоту всюду
      // задаёт бейдж статуса, а не наличие кнопки.
      meta: { flexible: true, className: `px-2 py-0 ${W.actions}` },
    },
  ]
}

/** Значения одного колоночного фильтра из состояния таблицы. */
function filterValues(
  columnFilters: ReturnType<typeof useTableSearchParams>['columnFilters'],
  id: string,
): string[] {
  const value = columnFilters.find((f) => f.id === id)?.value
  return Array.isArray(value) ? (value as string[]) : []
}

/**
 * Числовые id из фильтра. Мусор выбрасываем молча: значения приходят из адресной
 * строки, а схема экшена ждёт положительные целые — `Number('foo')` дал бы `NaN`,
 * валидация упала бы, и вся страница показала бы ошибку загрузки вместо таблицы.
 */
function filterIds(
  columnFilters: ReturnType<typeof useTableSearchParams>['columnFilters'],
  id: string,
): number[] {
  return filterValues(columnFilters, id)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
}

export default function PaymentsTable() {
  const { columnFilters, setColumnFilters, pagination, setPagination, sorting, setSorting } =
    useTableSearchParams({ filters: TABLE_FILTERS })

  const [{ from, to }, setPeriodValues] = useQueryStates(PERIOD_PARSERS, {
    shallow: true,
    history: 'replace',
  })

  const priceRange = useMemo(() => {
    const value = columnFilters.find((f) => f.id === 'price')?.value
    return Array.isArray(value) ? (value as [number?, number?]) : []
  }, [columnFilters])

  // Всё состояние таблицы уезжает в запрос: сервер сам отбирает, сортирует и режет
  // на страницы. Границы независимы — одна без другой значит открытый интервал.
  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      from: from ?? undefined,
      to: to ?? undefined,
      methodIds: filterIds(columnFilters, 'paymentMethod'),
      managerIds: filterIds(columnFilters, 'manager'),
      // Незнакомое значение отсеиваем по той же причине, что и нечисловые id.
      statuses: filterValues(columnFilters, 'status').filter((v): v is PaymentStatusValue =>
        PAYMENT_STATUSES.includes(v as PaymentStatusValue),
      ),
      priceMin: priceRange[0] ?? null,
      priceMax: priceRange[1] ?? null,
    }),
    [pagination, sorting, from, to, columnFilters, priceRange],
  )

  const { data, isLoading, isFetching, isError } = usePaymentListQuery(params)

  const { data: paymentMethods = [] } = useActivePaymentMethodListQuery()
  const { data: members = [] } = useMappedMemberListQuery()
  const { columnVisibility, setColumnVisibility } = useColumnVisibility('payments')

  const methodOptions = useMemo(
    () => paymentMethods.map((m) => ({ value: String(m.id), label: m.name })),
    [paymentMethods],
  )

  const columns = useMemo(() => buildColumns(methodOptions, members), [methodOptions, members])

  const resetPage = () => setPagination({ ...pagination, pageIndex: 0 })

  // Страница за последней: в адресе живёт `page` от прошлой, более полной выборки.
  // При `manualPagination` react-table сам её не подтягивает, и получалась пустая
  // таблица с «Страница 51 из 1» — при том, что оплаты есть.
  //
  // Зависимости — примитивы: `pagination` и `setPagination` пересоздаются на каждый
  // рендер, и с ними эффект прокручивался бы впустую каждый раз.
  const { pageIndex, pageSize } = pagination
  useEffect(() => {
    if (!data) return
    const lastPage = Math.max(0, Math.ceil(data.total / pageSize) - 1)
    if (pageIndex > lastPage) setPagination({ pageIndex: lastPage, pageSize })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.total, pageIndex, pageSize])

  // При `manualPagination` react-table больше не сбрасывает страницу сам, а без
  // сброса отбор в пять строк, сделанный со страницы четыре, показывает пустую
  // таблицу и «Страница 4 из 1».
  const setFiltersAndResetPage: typeof setColumnFilters = (updater) => {
    setColumnFilters(updater)
    resetPage()
  }

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Отбор, порядок и нарезка — в SQL. Клиентские модели строк выключены, поэтому
    // `filterFn` у колонок нет: предикаты живут в `where` серверного экшена.
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    // Иначе пагинации не из чего считать число страниц: она видит только текущую.
    rowCount: data?.total ?? 0,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setFiltersAndResetPage,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: { pagination, sorting, columnFilters, columnVisibility },
  })

  const resetFilters = () => {
    setPeriodValues({ from: null, to: null })
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
      isRefreshing={isFetching}
      // Отменённая оплата остаётся в списке следом операции, но читаться должна
      // как погашенная — одного бейджа в широкой строке не видно.
      rowClassName={(row) => (row.original.status === 'CANCELLED' ? 'opacity-55' : undefined)}
      toolbar={
        <DataTableToolbar
          table={table}
          onReset={resetFilters}
          hasExtraFilters={Boolean(from) || Boolean(to)}
        />
      }
    />
  )
}
