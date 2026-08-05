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
 * Каждый ключ становится URL-параметром со списком значений.
 */
type FilterConfig = Record<string, 'integer' | 'string'>

const SORT_ORDERS = ['asc', 'desc'] as const
const DEFAULT_PAGE_SIZE = 10

const QUERY_STATES_OPTIONS = { shallow: true, history: 'replace' as const }

const SEARCH_PARSERS = {
  q: parseAsString.withDefault('').withOptions({ shallow: true, throttleMs: 300 }),
}
const PAGINATION_PARSERS = {
  page: parseAsInteger.withDefault(0),
  pageSize: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
}
const SORTING_PARSERS = {
  sort: parseAsString.withDefault(''),
  order: parseAsStringLiteral(SORT_ORDERS).withDefault('asc'),
}

/**
 * Синхронизирует состояние таблицы (фильтры, поиск, пагинация, сортировка)
 * с URL search params через nuqs — вместо набора `useState`.
 *
 * Возвращает все четыре среза; таблица берёт только те, что ей нужны.
 *
 * @example
 * const { columnFilters, setColumnFilters, globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting }
 *   = useTableSearchParams({ filters: { course: 'integer', location: 'integer' } })
 */
export function useTableSearchParams({ filters }: { filters?: FilterConfig } = {}) {
  // Каллеры передают объектный литерал, поэтому стабилизируем конфиг по значению —
  // иначе парсеры пересоздавались бы на каждый рендер.
  const filtersKey = JSON.stringify(filters ?? {})
  const filterParsers = useMemo(() => {
    const config: FilterConfig = JSON.parse(filtersKey)
    return Object.fromEntries(
      Object.entries(config).map(([key, type]) => [
        key,
        type === 'integer'
          ? parseAsArrayOf(parseAsInteger).withDefault([])
          : parseAsArrayOf(parseAsString).withDefault([]),
      ]),
    )
  }, [filtersKey])

  const [filterValues, setFilterValues] = useQueryStates(filterParsers, QUERY_STATES_OPTIONS)
  const [searchValues, setSearchValues] = useQueryStates(SEARCH_PARSERS, QUERY_STATES_OPTIONS)
  const [paginationValues, setPaginationValues] = useQueryStates(
    PAGINATION_PARSERS,
    QUERY_STATES_OPTIONS,
  )
  const [sortingValues, setSortingValues] = useQueryStates(SORTING_PARSERS, QUERY_STATES_OPTIONS)

  const columnFilters: ColumnFiltersState = Object.entries(filterValues)
    .filter(([, value]) => Array.isArray(value) && value.length > 0)
    .map(([id, value]) => ({ id, value }))

  const pagination: PaginationState = {
    pageIndex: paginationValues.page,
    pageSize: paginationValues.pageSize,
  }

  const sorting: SortingState = sortingValues.sort
    ? [{ id: sortingValues.sort, desc: sortingValues.order === 'desc' }]
    : []

  // Сеттеры с API `useState` (значение или updater), как ждёт react-table.
  // Дефолтное значение пишем как `null`, чтобы параметр исчезал из URL.

  const setColumnFilters = (
    updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState),
  ) => {
    const next = typeof updater === 'function' ? updater(columnFilters) : updater
    setFilterValues(
      Object.fromEntries(
        Object.keys(filterParsers).map((key) => {
          const value = next.find((f) => f.id === key)?.value
          return [key, Array.isArray(value) && value.length > 0 ? value : null]
        }),
      ),
    )
  }

  const setGlobalFilter = (value: string) => {
    setSearchValues({ q: value || null })
    setPaginationValues({ page: null })
  }

  const setPagination = (
    updater: PaginationState | ((prev: PaginationState) => PaginationState),
  ) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    setPaginationValues({
      page: next.pageIndex === 0 ? null : next.pageIndex,
      pageSize: next.pageSize === DEFAULT_PAGE_SIZE ? null : next.pageSize,
    })
  }

  const setSorting = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const first = next[0]
    setSortingValues(
      first ? { sort: first.id, order: first.desc ? 'desc' : 'asc' } : { sort: null, order: null },
    )
  }

  return {
    columnFilters,
    setColumnFilters,
    globalFilter: searchValues.q,
    setGlobalFilter,
    pagination,
    setPagination,
    sorting,
    setSorting,
  }
}
