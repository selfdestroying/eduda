'use client'

import DataTable from '@repo/ui/components/data-table'
import { DataTableToolbar } from '@repo/ui/components/data-table-toolbar'
import { Hint } from '@repo/ui/components/hint'
import { Skeleton } from '@repo/ui/components/skeleton'
import { useMappedMemberListQuery } from '@/src/features/organization/members/queries'
import { useColumnVisibility } from '@/src/hooks/use-column-visibility'
import { useTableSearchParams } from '@/src/hooks/use-table-search-params'
import { formatDateOnly } from '@/src/lib/timezone'
import { formatCurrency, getFullName } from '@/src/lib/utils'
import { cn } from '@repo/ui/lib/utils'
import {
  type ColumnDef,
  type ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { debounce } from 'es-toolkit'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { parseAsString, useQueryStates } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'
import { usePackageListQuery } from '../queries'
import type { PackageListItem } from '../types'
import PackageActions from './package-actions'
import PackageDetails from './package-details'
import PeriodFilter, { PERIOD_TITLE, type Period } from './period-filter'

/**
 * Числовые колонки. Выключка левая, как у остального, — колонки узкие и заданной
 * ширины, так что разряды и без прижатия вправо стоят почти столбиком. Моноширинные
 * цифры оставлены: без них столбик разъезжается на каждой единице.
 */
const NUMERIC = 'tabular-nums'

/** Пауза после последнего нажатия клавиши, через которую поиск уходит на сервер. */
const SEARCH_DELAY_MS = 300

/**
 * Столько символов принимает схема запроса. Обрезаем здесь, а не полагаемся на её
 * отказ: вставленный в поиск абзац иначе не отбирал бы ничего, а ронял бы выборку
 * целиком.
 */
const SEARCH_MAX_LENGTH = 100

/**
 * Период. Живёт в URL отдельно от колоночных фильтров: колонки `date` в списке
 * фильтруемых нет — по дате отбирают диапазоном, а не галочками. Без границ
 * выборка не ограничена по дате: страницу режет сервер, и вся история стоит
 * столько же, сколько один месяц.
 */
const PERIOD_PARSERS = { from: parseAsString, to: parseAsString }

/**
 * Ширина всех колонок, кроме «Ученика». Суммы, числа и даты имеют известный потолок
 * длины, и делить между ними лишнее место незачем — весь остаток забирает имя,
 * единственная колонка с `meta.flexible` и без ширины. Оно же и единственное, что
 * реально бывает длинным.
 *
 * Порог горизонтальной прокрутки — сумма `size`: 4 × 130, 40 у шеврона, 56 у
 * действий и 150 у «Ученика» (столько react-table даёт колонке без явного `size`).
 */
const COLUMN_WIDTH = 130

/**
 * Колонки, по которым фильтруем: `useTableSearchParams` держит их в URL, а отсюда
 * они уезжают в запрос. Всё строками, включая id менеджера, — значения приходят из
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
      // Шеврон. Ширина под иконку, из меню «Колонки» не прячется: без него строку
      // нечем раскрыть.
      id: 'expander',
      header: () => null,
      size: 40,
      enableHiding: false,
      cell: ({ row }) => (
        <button
          type="button"
          // Раскрывает и вся строка, поэтому всплытие гасим: иначе один клик
          // сработал бы дважды и не изменил бы ничего.
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
          aria-label={row.getIsExpanded() ? 'Свернуть' : 'Подробнее'}
          aria-expanded={row.getIsExpanded()}
          className="text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ChevronDown
            className={cn('size-4 transition-transform', !row.getIsExpanded() && '-rotate-90')}
          />
        </button>
      ),
    },
    {
      id: 'student',
      header: 'Ученик',
      accessorFn: (row) => getFullName(row.student.firstName, row.student.lastName),
      cell: ({ row }) => (
        <Link
          href={`/students/${row.original.student.id}`}
          // Клик по строке раскрывает панель — по имени он должен только уводить
          // на карточку.
          onClick={(e) => e.stopPropagation()}
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
      header: () => (
        <span className="flex items-center gap-0.5">
          Занятий
          <Hint text="Сколько уроков в пакете. Остаток виден на карточке ученика." />
        </span>
      ),
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
      meta: { title: 'Дата' },
    },
    {
      id: 'manager',
      header: () => (
        <span className="flex items-center gap-0.5">
          Менеджер
          <Hint text="Кто продал пакет. У пакетов, заведённых до появления поля, менеджер не указан." />
        </span>
      ),
      accessorFn: (row) => row.manager?.name ?? '',
      size: COLUMN_WIDTH,
      cell: ({ row }) => row.original.manager?.name ?? '—',
      meta: {
        title: 'Менеджер',
        variant: 'multiSelect',
        options: managerOptions,
      },
    },
    {
      // Отмена пакета. Без `meta.title` — колонка не попадает в меню «Колонки»:
      // спрятать единственный способ отменить продажу нечем.
      id: 'actions',
      header: () => null,
      size: 56,
      enableHiding: false,
      // Всплытие меню гасит само — иначе у отменённого пакета, где показывать
      // нечего, обёртка всё равно съедала бы клик по строке.
      cell: ({ row }) => <PackageActions packet={row.original} />,
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

/** Границы диапазонного фильтра: `[min, max]`, любая может отсутствовать. */
function rangeValues(
  columnFilters: ReturnType<typeof useTableSearchParams>['columnFilters'],
  id: string,
): [number?, number?] {
  const value = columnFilters.find((f) => f.id === id)?.value
  return Array.isArray(value) ? (value as [number?, number?]) : []
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

export default function PackagesTable() {
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

  // Поле реагирует сразу, запрос — с задержкой. nuqs придерживает только запись в
  // адрес, а значение отдаёт тут же, так что без этого каждое нажатие клавиши
  // уходило бы отдельным запросом к серверу.
  const [searchTerm, setSearchTerm] = useState(globalFilter)
  const commitSearch = useMemo(() => debounce(setSearchTerm, SEARCH_DELAY_MS), [])
  // Отменяем на размонтировании: набранное за 300 мс до ухода со страницы иначе
  // дострелит по уже снятому компоненту.
  useEffect(() => {
    commitSearch(globalFilter)
    return () => commitSearch.cancel()
  }, [globalFilter, commitSearch])

  const [{ from, to }, setPeriodValues] = useQueryStates(PERIOD_PARSERS, {
    shallow: true,
    history: 'replace',
  })

  const priceRange = useMemo(() => rangeValues(columnFilters, 'price'), [columnFilters])
  const lessonsRange = useMemo(() => rangeValues(columnFilters, 'lessons'), [columnFilters])

  // Всё состояние таблицы уезжает в запрос: сервер сам отбирает, сортирует и режет
  // на страницы. Границы независимы — одна без другой значит открытый интервал.
  const params = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sort: sorting[0] ?? null,
      search: searchTerm.slice(0, SEARCH_MAX_LENGTH) || undefined,
      from: from ?? undefined,
      to: to ?? undefined,
      managerIds: filterIds(columnFilters, 'manager'),
      // Статус из интерфейса убран: все пакеты заводятся оплаченными, и фильтровать
      // не по чему. Параметр у запроса остался — отбор по статусу понадобится, когда
      // счета начнут приходить извне неоплаченными.
      statuses: [],
      priceMin: priceRange[0] ?? null,
      priceMax: priceRange[1] ?? null,
      lessonsMin: lessonsRange[0] ?? null,
      lessonsMax: lessonsRange[1] ?? null,
    }),
    [pagination, sorting, searchTerm, from, to, columnFilters, priceRange, lessonsRange],
  )

  const { data, isLoading, isFetching, isError } = usePackageListQuery(params)

  const { data: members = [] } = useMappedMemberListQuery()
  const { columnVisibility, setColumnVisibility } = useColumnVisibility('packages')

  const columns = useMemo(() => buildColumns(members), [members])

  // В адрес не уезжает, в отличие от сортировки и фильтров: раскрытая строка — это
  // взгляд на одну запись, а не состояние выборки, и ссылку с ней не пересылают.
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const resetPage = () => setPagination({ ...pagination, pageIndex: 0 })

  // Страница за последней: в адресе живёт `page` от прошлой, более полной выборки.
  // При `manualPagination` react-table сам её не подтягивает, и получалась пустая
  // таблица с «Страница 51 из 1» — при том, что пакеты есть.
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

  // По той же причине, что и колоночные: период — такой же отбор, просто живёт
  // не в состоянии таблицы.
  const setPeriod = (next: Period) => {
    setPeriodValues(next)
    resetPage()
  }

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Ключ строки — id пакета, а не её место на странице. По умолчанию react-table
    // нумерует строки индексом, и «раскрыта строка 2» после перелистывания означало
    // бы вторую строку новой страницы: раскрывались чужие записи.
    getRowId: (row) => String(row.id),
    // Раскрытие — не подстроки: панель показывает данные, которых в строке нет, и
    // раскрыть можно любую строку. Без `getRowCanExpand` react-table ищет `subRows`
    // и отвечает «нельзя» на всё.
    getRowCanExpand: () => true,
    getExpandedRowModel: getExpandedRowModel(),
    onExpandedChange: setExpanded,
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
    state: { pagination, sorting, columnFilters, columnVisibility, expanded },
  })

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
    return <div className="text-destructive">Ошибка при загрузке пакетов.</div>
  }

  return (
    <DataTable
      table={table}
      emptyMessage="Нет пакетов."
      showPagination
      showColumnVisibility
      isRefreshing={isFetching}
      renderSubComponent={(row) => (
        <PackageDetails packageId={row.original.id} open={row.getIsExpanded()} />
      )}
      onRowClick={(row) => row.toggleExpanded()}
      // Отменённый пакет остаётся в списке следом операции, но читаться должен
      // как погашенный — одного бейджа в широкой строке не видно.
      rowClassName={(row) => (row.original.status === 'CANCELLED' ? 'opacity-55' : undefined)}
      toolbar={
        <DataTableToolbar
          table={table}
          search={globalFilter}
          onSearchChange={setGlobalFilter}
          searchPlaceholder="Ученик, менеджер, продукт..."
          onReset={resetFilters}
          extraFilterTitles={from || to ? [PERIOD_TITLE] : []}
        >
          <PeriodFilter value={{ from, to }} onChange={setPeriod} />
        </DataTableToolbar>
      }
    />
  )
}
