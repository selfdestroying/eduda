'use client'

import type { ColumnFiltersState, PaginationState, VisibilityState } from '@tanstack/react-table'
import { debounce } from 'es-toolkit'
import { parseAsString, useQueryStates } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'
import { useColumnVisibility } from './use-column-visibility'
import { type FilterConfig, useTableSearchParams } from './use-table-search-params'

/** Пауза после последнего нажатия клавиши, через которую поиск уходит на сервер. */
const SEARCH_DELAY_MS = 300

/**
 * Столько символов принимают серверные схемы выборки. Обрезаем здесь, а не
 * полагаемся на их отказ: вставленный в поиск абзац иначе не отбирал бы ничего, а
 * ронял бы выборку целиком.
 */
const SEARCH_MAX_LENGTH = 100

/**
 * Период. Живёт в URL отдельно от колоночных фильтров: колонки с датой в списке
 * фильтруемых нет — по дате отбирают диапазоном, а не галочками. Параметры
 * появляются в адресе, только когда границы выставлены, поэтому таблицы без
 * периода ничего от них не получают и ничего не теряют.
 */
const periodParsers = (p: string) => ({
  [`${p}from`]: parseAsString,
  [`${p}to`]: parseAsString,
})

export interface Period {
  from: string | null
  to: string | null
}

/**
 * Всё состояние таблицы разом: фильтры, поиск, период, страница, сортировка и
 * видимость колонок. Один вызов вместо двух хуков и полусотни строк, которые до
 * этого копировались в каждую таблицу дословно.
 *
 * Отбор, порядок и страница живут в URL (`useTableSearchParams`), видимость
 * колонок — в `localStorage` (`useColumnVisibility`): первым делятся ссылкой,
 * второе — личная настройка рабочего места.
 *
 * Сеттеры отбора сбрасывают страницу сами. При `manualPagination` react-table
 * этого не делает, а без сброса отбор в пять строк, сделанный со страницы
 * четыре, показывает пустую таблицу и «Страница 4 из 1». Клиентские таблицы
 * сбрасывают её и сами — второй сброс им ничего не портит.
 *
 * @example
 * const t = useTableState({ id: 'packages', filters: { manager: 'string', price: 'range' } })
 * const params = useMemo(() => ({ ...,  managerIds: filterIds(t.columnFilters, 'manager') }), [...])
 */
export function useTableState({
  id,
  filters,
  defaultVisibility,
  prefix = '',
}: {
  id: string
  filters?: FilterConfig
  /** Колонки, скрытые до первой настройки, — например та, что нужна только как фильтр. */
  defaultVisibility?: VisibilityState
  /**
   * Приставка к именам параметров в адресе. Обязательна, когда на странице больше
   * одной таблицы: имена `q`/`page`/`sort` фиксированы, и без неё поиск в одной
   * таблице отбирал бы заодно и в соседней.
   */
  prefix?: string
}) {
  const {
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    sorting,
    setSorting,
  } = useTableSearchParams({ filters, prefix })

  const { columnVisibility, setColumnVisibility } = useColumnVisibility(id, defaultVisibility)

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

  const periodParserSet = useMemo(() => periodParsers(prefix), [prefix])
  const [periodValues, setPeriodValues] = useQueryStates(periodParserSet, {
    shallow: true,
    history: 'replace',
  })
  const period: Period = useMemo(
    () => ({
      from: (periodValues[`${prefix}from`] ?? null) as string | null,
      to: (periodValues[`${prefix}to`] ?? null) as string | null,
    }),
    // Ссылка обязана быть стабильной: `period` уходит в зависимости `useMemo`,
    // собирающего параметры запроса.
    [periodValues, prefix],
  )

  const resetPage = () => setPagination({ ...pagination, pageIndex: 0 })

  const setFiltersAndResetPage: typeof setColumnFilters = (updater) => {
    setColumnFilters(updater)
    resetPage()
  }

  // По той же причине, что и колоночные: период — такой же отбор, просто живёт
  // не в состоянии таблицы.
  const setPeriod = (next: Period) => {
    setPeriodValues({ [`${prefix}from`]: next.from, [`${prefix}to`]: next.to })
    resetPage()
  }

  /** Сброс всего сразу: поиск, колоночные фильтры, период и страница. */
  const reset = () => {
    setPeriodValues({ [`${prefix}from`]: null, [`${prefix}to`]: null })
    setGlobalFilter('')
    setColumnFilters([])
    resetPage()
  }

  return {
    columnFilters,
    setColumnFilters: setFiltersAndResetPage,
    globalFilter,
    setGlobalFilter,
    /** Поиск для запроса: с задержкой и обрезанный по потолку серверной схемы. */
    search: searchTerm.slice(0, SEARCH_MAX_LENGTH) || undefined,
    pagination,
    setPagination,
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
    period,
    setPeriod,
    resetPage,
    reset,
  }
}

/**
 * Страница за последней: в адресе живёт `page` от прошлой, более полной выборки.
 * При `manualPagination` react-table сам её не подтягивает, и получалась пустая
 * таблица с «Страница 51 из 1» — при том, что строки есть.
 *
 * Зависимости — примитивы: `pagination` и `setPagination` пересоздаются на каждый
 * рендер, и с ними эффект прокручивался бы впустую каждый раз.
 */
export function useClampPage(
  pagination: PaginationState,
  setPagination: (next: PaginationState) => void,
  total: number | undefined,
) {
  const { pageIndex, pageSize } = pagination
  useEffect(() => {
    if (total === undefined) return
    const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1)
    if (pageIndex > lastPage) setPagination({ pageIndex: lastPage, pageSize })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, pageIndex, pageSize])
}

/** Значения одного колоночного фильтра из состояния таблицы. */
export function filterValues(columnFilters: ColumnFiltersState, id: string): string[] {
  const value = columnFilters.find((f) => f.id === id)?.value
  return Array.isArray(value) ? (value as string[]) : []
}

/** Границы диапазонного фильтра: `[min, max]`, любая может отсутствовать. */
export function rangeValues(columnFilters: ColumnFiltersState, id: string): [number?, number?] {
  const value = columnFilters.find((f) => f.id === id)?.value
  return Array.isArray(value) ? (value as [number?, number?]) : []
}

/**
 * Числовые id из фильтра. Мусор выбрасываем молча: значения приходят из адресной
 * строки, а схемы экшенов ждут положительные целые — `Number('foo')` дал бы `NaN`,
 * валидация упала бы, и вся страница показала бы ошибку загрузки вместо таблицы.
 */
export function filterIds(columnFilters: ColumnFiltersState, id: string): number[] {
  return filterValues(columnFilters, id)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
}
