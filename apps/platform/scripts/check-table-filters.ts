/**
 * Разбор значений колоночных фильтров (`src/hooks/use-table-state.ts`).
 *
 * Эти три функции стоят между адресной строкой и `inputSchema` серверных
 * экшенов: всё, что они пропустят, уедет в Zod, а он на мусоре не отбирает
 * лишнее, а роняет выборку целиком — вместо таблицы страница показывает ошибку
 * загрузки. Поэтому проверяется не «работает на нормальных данных», а поведение
 * ровно на подобранном руками адресе.
 *
 * БД не нужна — функции чистые:
 *
 *   pnpm --filter platform exec tsx scripts/check-table-filters.ts
 */
import assert from 'node:assert/strict'

import type { ColumnFiltersState } from '@tanstack/react-table'

import { filterIds, filterValues, rangeValues } from '../src/hooks/use-table-state'

const filters: ColumnFiltersState = [
  { id: 'manager', value: ['1', '2'] },
  { id: 'course', value: ['3', 'foo', '', '-1', '0', '2.5'] },
  { id: 'price', value: [1000, undefined] },
  { id: 'lessons', value: [undefined, 8] },
  // Так выглядит фильтр, пришедший из адреса с одним значением без скобок.
  { id: 'broken', value: 'not-an-array' },
]

// filterValues: массив как есть, всё остальное — пусто.
assert.deepEqual(filterValues(filters, 'manager'), ['1', '2'])
assert.deepEqual(filterValues(filters, 'broken'), [])
assert.deepEqual(filterValues(filters, 'missing'), [])

// filterIds: мусор молча выбрасывается, а не превращается в NaN.
assert.deepEqual(filterIds(filters, 'manager'), [1, 2])
assert.deepEqual(filterIds(filters, 'course'), [3])
assert.deepEqual(filterIds(filters, 'missing'), [])

// rangeValues: любая граница может отсутствовать, обе — законны по отдельности.
assert.deepEqual(rangeValues(filters, 'price'), [1000, undefined])
assert.deepEqual(rangeValues(filters, 'lessons'), [undefined, 8])
assert.deepEqual(rangeValues(filters, 'missing'), [])

console.log('✓ Разбор колоночных фильтров: все проверки пройдены')
