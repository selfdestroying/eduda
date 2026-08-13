'use client'

import type { OnChangeFn, VisibilityState } from '@tanstack/react-table'
import { useEffect, useState } from 'react'

const storageKey = (tableId: string) => `table-columns:${tableId}`

/**
 * Видимость колонок таблицы, переживающая перезагрузку.
 *
 * `localStorage`, а не URL: какие колонки человек себе скрыл — его личная
 * настройка рабочего места, а не часть адреса страницы, которым делятся.
 *
 * Стартуем с «показаны все» и подтягиваем сохранённое в эффекте: на сервере
 * `localStorage` нет, и чтение прямо в инициализаторе разошлось бы с разметкой
 * при гидрации. Пишем в сеттере, а не отдельным эффектом, — иначе первый прогон
 * успел бы затереть сохранённое пустым объектом. Сеттер устроен как в
 * `useTableSearchParams`: `next` считается снаружи, апдейтер остаётся чистым.
 *
 * `defaultVisibility` — колонки, скрытые до первой настройки: например, та, что
 * нужна только как фильтр в тулбаре. Сохранённое состояние её перекрывает.
 *
 * @example
 * const { columnVisibility, setColumnVisibility } = useColumnVisibility('payments', { kind: false })
 */
export function useColumnVisibility(tableId: string, defaultVisibility: VisibilityState = {}) {
  const [columnVisibility, setState] = useState<VisibilityState>(defaultVisibility)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey(tableId))
    if (!stored) return
    try {
      // Поверх дефолтов, а не вместо них: в сохранённом объекте нет ключей для
      // колонок, появившихся после последней настройки, и целиком подменяя
      // состояние мы бы показали то, что задумано скрытым. Явный выбор человека
      // при этом всё равно перекрывает дефолт — он лежит справа.
      setState({ ...defaultVisibility, ...(JSON.parse(stored) as VisibilityState) })
    } catch {
      localStorage.removeItem(storageKey(tableId))
    }
    // `defaultVisibility` намеренно вне зависимостей: каллеры передают объектный
    // литерал, и с ним эффект перезапускался бы на каждый рендер, вызывая
    // `setState` по кругу. Значение с первого рендера — то же самое.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  const setColumnVisibility: OnChangeFn<VisibilityState> = (updater) => {
    const next = typeof updater === 'function' ? updater(columnVisibility) : updater
    localStorage.setItem(storageKey(tableId), JSON.stringify(next))
    setState(next)
  }

  return { columnVisibility, setColumnVisibility }
}
