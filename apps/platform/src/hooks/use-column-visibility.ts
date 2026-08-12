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
 * @example
 * const { columnVisibility, setColumnVisibility } = useColumnVisibility('payments')
 */
export function useColumnVisibility(tableId: string) {
  const [columnVisibility, setState] = useState<VisibilityState>({})

  useEffect(() => {
    const stored = localStorage.getItem(storageKey(tableId))
    if (!stored) return
    try {
      setState(JSON.parse(stored) as VisibilityState)
    } catch {
      localStorage.removeItem(storageKey(tableId))
    }
  }, [tableId])

  const setColumnVisibility: OnChangeFn<VisibilityState> = (updater) => {
    const next = typeof updater === 'function' ? updater(columnVisibility) : updater
    localStorage.setItem(storageKey(tableId), JSON.stringify(next))
    setState(next)
  }

  return { columnVisibility, setColumnVisibility }
}
