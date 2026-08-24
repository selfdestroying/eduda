'use client'

import { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import { useMemo } from 'react'

/**
 * Маппинг id колонки → тип значения фильтра.
 *
 * `integer`/`string` — мультиселект: один URL-параметр со списком значений.
 * `range` — числовой диапазон: два параметра, `<key>Min` и `<key>Max`, а таблице
 * отдаётся `[min, max]`, где любая граница может быть `undefined`. Двумя
 * параметрами, а не одним «1000-5000», чтобы «только от» и «только до»
 * выражались без придуманных заполнителей и адрес читался глазами.
 */
export type FilterConfig = Record<string, 'integer' | 'string' | 'range'>

const SORT_ORDERS = ['asc', 'desc'] as const
const DEFAULT_PAGE_SIZE = 10
/** Потолок серверных схем выборки — держим его и здесь, чтобы запрос не падал. */
const MAX_PAGE_SIZE = 100

const QUERY_STATES_OPTIONS = { shallow: true, history: 'replace' as const }

const searchParsers = (p: string) => ({
  [`${p}q`]: parseAsString.withDefault('').withOptions({ shallow: true, throttleMs: 300 }),
})
/**
 * `page` в адресе считается с единицы, а не с нуля: ссылками делятся и их читают
 * глазами, а подпись под таблицей говорит «Страница 2». Внутрь react-table идёт
 * его 0-based `pageIndex` — перевод живёт здесь, в одном месте.
 */
const paginationParsers = (p: string) => ({
  [`${p}page`]: parseAsInteger.withDefault(1),
  [`${p}pageSize`]: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
})
const sortingParsers = (p: string) => ({
  [`${p}sort`]: parseAsString.withDefault(''),
  [`${p}order`]: parseAsStringLiteral(SORT_ORDERS).withDefault('asc'),
})

/**
 * Синхронизирует состояние таблицы (фильтры, поиск, пагинация, сортировка)
 * с URL search params через nuqs — вместо набора `useState`.
 *
 * Возвращает все четыре среза; таблица берёт только те, что ей нужны.
 *
 * `prefix` приписывается ко всем именам параметров. Он обязателен, когда на
 * странице больше одной таблицы: имена `q`/`page`/`sort` фиксированы, и без
 * приставки поиск в одной таблице отбирал бы заодно и в соседней. Страничные
 * таблицы живут без приставки — их адреса уже разошлись по ссылкам.
 *
 * @example
 * const { columnFilters, setColumnFilters, globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting }
 *   = useTableSearchParams({ filters: { course: 'integer', location: 'integer' } })
 */
export function useTableSearchParams({
  filters,
  prefix = '',
}: { filters?: FilterConfig; prefix?: string } = {}) {
  // Каллеры передают объектный литерал, поэтому стабилизируем конфиг по значению —
  // иначе парсеры пересоздавались бы на каждый рендер.
  const filtersKey = JSON.stringify(filters ?? {})
  const config = useMemo(() => JSON.parse(filtersKey) as FilterConfig, [filtersKey])

  const filterParsers = useMemo(() => {
    const parsers: Record<string, Parameters<typeof useQueryStates>[0][string]> = {}
    for (const [key, type] of Object.entries(config)) {
      if (type === 'range') {
        // Диапазон — два параметра: «только от» и «только до» должны выражаться
        // без придуманной второй границы.
        parsers[`${prefix}${key}Min`] = parseAsInteger
        parsers[`${prefix}${key}Max`] = parseAsInteger
        continue
      }
      parsers[`${prefix}${key}`] =
        type === 'integer'
          ? parseAsArrayOf(parseAsInteger).withDefault([])
          : parseAsArrayOf(parseAsString).withDefault([])
    }
    return parsers
  }, [config, prefix])

  const searchParserSet = useMemo(() => searchParsers(prefix), [prefix])
  const paginationParserSet = useMemo(() => paginationParsers(prefix), [prefix])
  const sortingParserSet = useMemo(() => sortingParsers(prefix), [prefix])

  const [filterValues, setFilterValues] = useQueryStates(filterParsers, QUERY_STATES_OPTIONS)
  const [searchValues, setSearchValues] = useQueryStates(searchParserSet, QUERY_STATES_OPTIONS)
  const [paginationValues, setPaginationValues] = useQueryStates(
    paginationParserSet,
    QUERY_STATES_OPTIONS,
  )
  const [sortingValues, setSortingValues] = useQueryStates(sortingParserSet, QUERY_STATES_OPTIONS)

  const searchValue = (searchValues[`${prefix}q`] ?? '') as string
  const pageValue = (paginationValues[`${prefix}page`] ?? 1) as number
  const pageSizeValue = (paginationValues[`${prefix}pageSize`] ?? DEFAULT_PAGE_SIZE) as number
  const sortValue = (sortingValues[`${prefix}sort`] ?? '') as string
  const orderValue = (sortingValues[`${prefix}order`] ?? 'asc') as 'asc' | 'desc'

  // Все три среза обязаны сохранять ссылку между рендерами. Модели строк
  // react-table мемоизированы по идентичности этих объектов, а на каждый
  // пересчёт дёргают `_autoResetPageIndex()`. Новый литерал на каждый рендер
  // означает пересчёт на каждый рендер и, значит, сброс на первую страницу
  // сразу после клика по «вперёд» — пагинация просто перестаёт работать.
  // nuqs свои значения уже мемоизирует, так что зависимости здесь стабильны.
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const result: ColumnFiltersState = []
    for (const [key, type] of Object.entries(config)) {
      if (type === 'range') {
        const min = filterValues[`${prefix}${key}Min`] as number | null | undefined
        const max = filterValues[`${prefix}${key}Max`] as number | null | undefined
        if (min != null || max != null) {
          result.push({ id: key, value: [min ?? undefined, max ?? undefined] })
        }
        continue
      }
      const value = filterValues[`${prefix}${key}`]
      if (Array.isArray(value) && value.length > 0) result.push({ id: key, value })
    }
    return result
  }, [config, filterValues, prefix])

  const pagination: PaginationState = useMemo(
    // Обе границы не украшательство: в адресе может оказаться `page=0` или
    // отрицательное, а `pageIndex: -1` дал бы `skip: -10` и ошибку запроса.
    // `pageSize` зажимаем по той же причине — серверные схемы ждут `1..100`, и
    // подобранный руками `pageSize=0` уронил бы валидацию, то есть показал бы
    // ошибку загрузки вместо таблицы.
    () => ({
      pageIndex: Math.max(0, pageValue - 1),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeValue)),
    }),
    [pageValue, pageSizeValue],
  )

  const sorting: SortingState = useMemo(
    () => (sortValue ? [{ id: sortValue, desc: orderValue === 'desc' }] : []),
    [sortValue, orderValue],
  )

  // Сеттеры с API `useState` (значение или updater), как ждёт react-table.
  // Дефолтное значение пишем как `null`, чтобы параметр исчезал из URL.

  const setColumnFilters = (
    updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState),
  ) => {
    const next = typeof updater === 'function' ? updater(columnFilters) : updater
    const patch: Record<string, unknown> = {}
    for (const [key, type] of Object.entries(config)) {
      const value = next.find((f) => f.id === key)?.value
      if (type === 'range') {
        const [min, max] = (value as [number?, number?] | undefined) ?? []
        patch[`${prefix}${key}Min`] = min ?? null
        patch[`${prefix}${key}Max`] = max ?? null
        continue
      }
      patch[`${prefix}${key}`] = Array.isArray(value) && value.length > 0 ? value : null
    }
    setFilterValues(patch)
  }

  const setGlobalFilter = (value: string) => {
    setSearchValues({ [`${prefix}q`]: value || null })
    setPaginationValues({ [`${prefix}page`]: null })
  }

  const setPagination = (
    updater: PaginationState | ((prev: PaginationState) => PaginationState),
  ) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    setPaginationValues({
      // Первая страница — дефолт, а дефолт пишем как `null`, чтобы параметра в
      // адресе не было вовсе.
      [`${prefix}page`]: next.pageIndex === 0 ? null : next.pageIndex + 1,
      [`${prefix}pageSize`]: next.pageSize === DEFAULT_PAGE_SIZE ? null : next.pageSize,
    })
  }

  const setSorting = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const first = next[0]
    setSortingValues(
      first
        ? { [`${prefix}sort`]: first.id, [`${prefix}order`]: first.desc ? 'desc' : 'asc' }
        : { [`${prefix}sort`]: null, [`${prefix}order`]: null },
    )
  }

  return {
    columnFilters,
    setColumnFilters,
    globalFilter: searchValue,
    setGlobalFilter,
    pagination,
    setPagination,
    sorting,
    setSorting,
  }
}
