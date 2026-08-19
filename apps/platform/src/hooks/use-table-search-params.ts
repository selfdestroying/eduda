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
type FilterConfig = Record<string, 'integer' | 'string' | 'range'>

const SORT_ORDERS = ['asc', 'desc'] as const
const DEFAULT_PAGE_SIZE = 10

const QUERY_STATES_OPTIONS = { shallow: true, history: 'replace' as const }

const SEARCH_PARSERS = {
  q: parseAsString.withDefault('').withOptions({ shallow: true, throttleMs: 300 }),
}
/**
 * `page` в адресе считается с единицы, а не с нуля: ссылками делятся и их читают
 * глазами, а подпись под таблицей говорит «Страница 2». Внутрь react-table идёт
 * его 0-based `pageIndex` — перевод живёт здесь, в одном месте.
 */
const PAGINATION_PARSERS = {
  page: parseAsInteger.withDefault(1),
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
  const config = useMemo(() => JSON.parse(filtersKey) as FilterConfig, [filtersKey])

  const filterParsers = useMemo(() => {
    const parsers: Record<string, Parameters<typeof useQueryStates>[0][string]> = {}
    for (const [key, type] of Object.entries(config)) {
      if (type === 'range') {
        // Диапазон — два параметра: «только от» и «только до» должны выражаться
        // без придуманной второй границы.
        parsers[`${key}Min`] = parseAsInteger
        parsers[`${key}Max`] = parseAsInteger
        continue
      }
      parsers[key] =
        type === 'integer'
          ? parseAsArrayOf(parseAsInteger).withDefault([])
          : parseAsArrayOf(parseAsString).withDefault([])
    }
    return parsers
  }, [config])

  const [filterValues, setFilterValues] = useQueryStates(filterParsers, QUERY_STATES_OPTIONS)
  const [searchValues, setSearchValues] = useQueryStates(SEARCH_PARSERS, QUERY_STATES_OPTIONS)
  const [paginationValues, setPaginationValues] = useQueryStates(
    PAGINATION_PARSERS,
    QUERY_STATES_OPTIONS,
  )
  const [sortingValues, setSortingValues] = useQueryStates(SORTING_PARSERS, QUERY_STATES_OPTIONS)

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
        const min = filterValues[`${key}Min`] as number | null | undefined
        const max = filterValues[`${key}Max`] as number | null | undefined
        if (min != null || max != null) {
          result.push({ id: key, value: [min ?? undefined, max ?? undefined] })
        }
        continue
      }
      const value = filterValues[key]
      if (Array.isArray(value) && value.length > 0) result.push({ id: key, value })
    }
    return result
  }, [config, filterValues])

  const pagination: PaginationState = useMemo(
    // `Math.max` не украшательство: в адресе может оказаться `page=0` или
    // отрицательное, а `pageIndex: -1` дал бы `skip: -10` и ошибку запроса.
    () => ({
      pageIndex: Math.max(0, paginationValues.page - 1),
      pageSize: paginationValues.pageSize,
    }),
    [paginationValues.page, paginationValues.pageSize],
  )

  const sorting: SortingState = useMemo(
    () =>
      sortingValues.sort ? [{ id: sortingValues.sort, desc: sortingValues.order === 'desc' }] : [],
    [sortingValues.sort, sortingValues.order],
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
        patch[`${key}Min`] = min ?? null
        patch[`${key}Max`] = max ?? null
        continue
      }
      patch[key] = Array.isArray(value) && value.length > 0 ? value : null
    }
    setFilterValues(patch)
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
      // Первая страница — дефолт, а дефолт пишем как `null`, чтобы параметра в
      // адресе не было вовсе.
      page: next.pageIndex === 0 ? null : next.pageIndex + 1,
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
