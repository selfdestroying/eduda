'use client'

import { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import { useCallback, useEffect, useMemo, useRef } from 'react'

/**
 * Конфигурация для определения каких URL параметров хуку отслеживать.
 * Каждый ключ - id колонки в таблице, значение - тип парсера.
 */
type FilterConfig = Record<string, 'integer' | 'string'>

interface UseTableSearchParamsOptions {
  /** Маппинг id колонки → тип значения фильтра */
  filters?: FilterConfig
  /** Включить поиск (globalFilter) через URL параметр `q` */
  search?: boolean
  /** Включить пагинацию через URL параметры `page` и `pageSize` */
  pagination?: boolean | { defaultPageSize?: number }
  /** Включить сортировку через URL параметры `sort` и `order` */
  sorting?: boolean
}

const SORT_ORDERS = ['asc', 'desc'] as const

// Stable parsers that don't depend on config (created once)
const SEARCH_PARSERS = {
  q: parseAsString.withDefault('').withOptions({ shallow: true, throttleMs: 300 }),
}
const PAGINATION_PARSERS_DEFAULT = {
  page: parseAsInteger.withDefault(0),
  pageSize: parseAsInteger.withDefault(10),
}
const SORTING_PARSERS = {
  sort: parseAsString.withDefault(''),
  order: parseAsStringLiteral(SORT_ORDERS).withDefault('asc'),
}
const QUERY_STATES_OPTIONS = { shallow: true, history: 'replace' as const }

/**
 * Хук для синхронизации состояния таблицы с URL search params через nuqs.
 * Заменяет множественные useState для columnFilters, globalFilter, pagination, sorting.
 *
 * @example
 * const { columnFilters, setColumnFilters, globalFilter, setGlobalFilter, pagination, setPagination, sorting, setSorting }
 *   = useTableSearchParams({
 *       filters: { course: 'integer', location: 'integer', teacher: 'integer' },
 *       search: true,
 *       pagination: true,
 *       sorting: true,
 *     })
 */
export function useTableSearchParams(options: UseTableSearchParamsOptions = {}) {
  const { filters = {}, search = false, pagination = false, sorting = false } = options

  // Stabilize filters config reference via JSON serialization
  const filtersKey = JSON.stringify(filters)
  const stableFilters: FilterConfig = useMemo(() => JSON.parse(filtersKey), [filtersKey])
  const filterKeys = useMemo(() => Object.keys(stableFilters), [stableFilters])

  // Build parsers once per stable config
  const filterParsers = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsers: Record<string, any> = {}
    for (const [key, type] of Object.entries(stableFilters)) {
      parsers[key] =
        type === 'integer'
          ? parseAsArrayOf(parseAsInteger).withDefault([])
          : parseAsArrayOf(parseAsString).withDefault([])
    }
    return parsers
  }, [stableFilters])

  const [filterValues, setFilterValues] = useQueryStates(filterParsers, QUERY_STATES_OPTIONS)

  // Search
  const [searchValues, setSearchValues] = useQueryStates(SEARCH_PARSERS, QUERY_STATES_OPTIONS)

  // Pagination
  const defaultPageSize = typeof pagination === 'object' ? (pagination.defaultPageSize ?? 10) : 10

  const paginationParsers = useMemo(
    () =>
      defaultPageSize === 10
        ? PAGINATION_PARSERS_DEFAULT
        : {
            page: parseAsInteger.withDefault(0),
            pageSize: parseAsInteger.withDefault(defaultPageSize),
          },
    [defaultPageSize],
  )
  const [paginationValues, setPaginationValues] = useQueryStates(
    paginationParsers,
    QUERY_STATES_OPTIONS,
  )

  // Sorting
  const [sortingValues, setSortingValues] = useQueryStates(SORTING_PARSERS, QUERY_STATES_OPTIONS)

  // Convert filter URL values → ColumnFiltersState for react-table
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const result: ColumnFiltersState = []
    for (const key of filterKeys) {
      const value = filterValues[key]
      if (value && Array.isArray(value) && value.length > 0) {
        result.push({ id: key, value })
      }
    }
    return result
  }, [filterKeys, filterValues])

  // Use refs to break circular dependencies in callbacks
  const columnFiltersRef = useRef(columnFilters)
  const paginationStateRef = useRef<PaginationState>({ pageIndex: 0, pageSize: defaultPageSize })
  const sortingStateRef = useRef<SortingState>([])

  useEffect(() => {
    columnFiltersRef.current = columnFilters
  }, [columnFilters])

  // setColumnFilters: accepts ColumnFiltersState updater (same API as useState setter)
  const setColumnFilters = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === 'function' ? updater(columnFiltersRef.current) : updater

      const update: Record<string, number[] | string[] | null> = {}
      for (const key of filterKeys) {
        const filter = newFilters.find((f) => f.id === key)
        if (filter && Array.isArray(filter.value) && filter.value.length > 0) {
          update[key] = filter.value
        } else {
          update[key] = null
        }
      }

      setFilterValues(update)
    },
    [filterKeys, setFilterValues],
  )

  // Global filter (search)
  const globalFilter = search ? (searchValues.q ?? '') : ''
  const setGlobalFilter = useCallback(
    (value: string) => {
      if (!search) return
      setSearchValues({ q: value || null })
      if (pagination) {
        setPaginationValues({ page: null })
      }
    },
    [search, setSearchValues, pagination, setPaginationValues],
  )

  // Pagination state for react-table
  const paginationState: PaginationState = useMemo(
    () => ({
      pageIndex: pagination ? (paginationValues.page ?? 0) : 0,
      pageSize: pagination ? (paginationValues.pageSize ?? defaultPageSize) : defaultPageSize,
    }),
    [pagination, paginationValues, defaultPageSize],
  )
  useEffect(() => {
    paginationStateRef.current = paginationState
  }, [paginationState])

  const setPagination = useCallback(
    (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      if (!pagination) return
      const newPagination =
        typeof updater === 'function' ? updater(paginationStateRef.current) : updater

      setPaginationValues({
        page: newPagination.pageIndex === 0 ? null : newPagination.pageIndex,
        pageSize: newPagination.pageSize === defaultPageSize ? null : newPagination.pageSize,
      })
    },
    [pagination, setPaginationValues, defaultPageSize],
  )

  // Sorting state for react-table
  const sortingState: SortingState = useMemo(() => {
    if (!sorting || !sortingValues.sort) return []
    return [{ id: sortingValues.sort, desc: sortingValues.order === 'desc' }]
  }, [sorting, sortingValues])
  useEffect(() => {
    sortingStateRef.current = sortingState
  }, [sortingState])

  const setSorting = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      if (!sorting) return
      const newSorting = typeof updater === 'function' ? updater(sortingStateRef.current) : updater

      if (newSorting.length === 0) {
        setSortingValues({ sort: null, order: null })
      } else {
        const firstSort = newSorting[0]!
        setSortingValues({
          sort: firstSort.id,
          order: firstSort.desc ? 'desc' : 'asc',
        })
      }
    },
    [sorting, setSortingValues],
  )

  return {
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    pagination: paginationState,
    setPagination,
    sorting: sortingState,
    setSorting,
  }
}
