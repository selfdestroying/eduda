'use client'

import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@repo/ui/components/command'
import { Input } from '@repo/ui/components/input'
import { NumberInput } from '@repo/ui/components/number-input'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'
import { Separator } from '@repo/ui/components/separator'
import { cn } from '@repo/ui/lib/utils'
import type { Column, RowData, Table as TanstackTable } from '@tanstack/react-table'
import { Check, ListFilter, Search, X } from 'lucide-react'
import { type ReactNode } from 'react'

/**
 * Тулбар таблицы: поиск, фильтры и сброс. Набор фильтров не передаётся пропсами —
 * он выводится из колонок: колонка с `meta.variant` получает свой контрол, без
 * `meta.variant` не получает. Добавить фильтр значит дописать `meta` рядом с
 * колонкой, а не завести пропс, парсер, хендлер и ветку разметки.
 *
 * Каждый контрол показывает своё состояние на себе (как faceted-фильтры shadcn),
 * поэтому отдельной строки «чипсов» под тулбаром нет: дублировать выбранное
 * негде и нечем рассинхронизироваться.
 */
interface DataTableToolbarProps<TData extends RowData> {
  table: TanstackTable<TData>
  /** Значение глобального поиска. Без пары `search`/`onSearchChange` поле не рисуется. */
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /**
   * Фильтры, которых нет среди колонок, — например период, уезжающий на сервер.
   * Встают слева от колоночных.
   */
  children?: ReactNode
  /** Сброс всего сразу: колоночные фильтры таблица снимет сама, остальное — здесь. */
  onReset?: () => void
  /**
   * Активен ли хоть один фильтр из `children`. Про них тулбар знать не может, а
   * `onReset` их чистит — без этого флага кнопка сброса пряталась бы, когда
   * сбрасывать как раз есть что.
   */
  hasExtraFilters?: boolean
  className?: string
}

export function DataTableToolbar<TData extends RowData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder = 'Поиск...',
  children,
  onReset,
  hasExtraFilters = false,
  className,
}: DataTableToolbarProps<TData>) {
  const filterableColumns = table.getAllColumns().filter((c) => c.columnDef.meta?.variant)

  // Сброс предлагаем, только когда есть что сбрасывать: пустая кнопка «Сбросить»
  // рядом с чистой таблицей — шум.
  const isFiltered =
    table.getState().columnFilters.length > 0 || Boolean(search) || hasExtraFilters

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {onSearchChange && (
        <div className="relative w-full sm:w-56">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
            aria-label={searchPlaceholder}
          />
        </div>
      )}

      {children}

      {filterableColumns.map((column) =>
        column.columnDef.meta?.variant === 'range' ? (
          <DataTableRangeFilter key={column.id} column={column} />
        ) : (
          <DataTableFacetedFilter key={column.id} column={column} />
        ),
      )}

      {isFiltered && onReset && (
        <Button variant="ghost" className="text-muted-foreground" onClick={onReset}>
          <X />
          Сбросить
        </Button>
      )}
    </div>
  )
}

/** Подпись фильтра: `meta.title`, иначе id — заголовок колонки часто JSX. */
function columnTitle<TData extends RowData>(column: Column<TData, unknown>) {
  return column.columnDef.meta?.title ?? column.id
}

/**
 * Мультиселект с галочками и поиском по вариантам. Выбранное показывается на
 * самой кнопке: до двух — названиями, дальше — числом, иначе строка фильтров
 * расползается на пол-экрана.
 */
function DataTableFacetedFilter<TData extends RowData>({
  column,
}: {
  column: Column<TData, unknown>
}) {
  const options = column.columnDef.meta?.options ?? []
  const title = columnTitle(column)
  // Значение колоночного фильтра — массив строк; из URL иначе и не приходит.
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? [])

  const toggle = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    // Пустой фильтр снимаем целиком, чтобы он исчез и из URL, и из счётчика.
    column.setFilterValue(next.size > 0 ? [...next] : undefined)
  }

  const selectedOptions = options.filter((o) => selected.has(o.value))

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" className="font-normal" />}>
        <ListFilter />
        {title}
        {selectedOptions.length > 0 && (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-4" />
            {selectedOptions.length > 2 ? (
              <Badge variant="secondary">{selectedOptions.length}</Badge>
            ) : (
              selectedOptions.map((o) => (
                <Badge key={o.value} variant="secondary">
                  {o.label}
                </Badge>
              ))
            )}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        {/* Без поля поиска: списки здесь короткие — методы оплаты, сотрудники,
            три вида, — и строка ввода над пятью галочками только мешает.
            `Command` оставлен ради навигации стрелками. */}
        <Command>
          <CommandList>
            {options.length === 0 && (
              <p className="text-muted-foreground p-2 text-xs">Нет вариантов.</p>
            )}
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value)
                return (
                  <CommandItem key={option.value} onSelect={() => toggle(option.value)}>
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-[4px] border',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input',
                      )}
                    >
                      {isSelected && <Check className="size-3" />}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column.setFilterValue(undefined)}
                    className="justify-center"
                  >
                    Снять фильтр
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Числовой диапазон. Значение фильтра — `[min, max]`, любая граница может быть
 * `undefined`: «от 1000» и «до 5000» одинаково законны.
 */
function DataTableRangeFilter<TData extends RowData>({
  column,
}: {
  column: Column<TData, unknown>
}) {
  const title = columnTitle(column)
  const unit = column.columnDef.meta?.unit
  const [min, max] = (column.getFilterValue() as [number?, number?] | undefined) ?? []

  const set = (next: [number | undefined, number | undefined]) =>
    // Обе границы пусты — фильтра нет: иначе он висел бы в URL и в счётчике,
    // ничего не отбирая.
    column.setFilterValue(next[0] === undefined && next[1] === undefined ? undefined : next)

  const label =
    min !== undefined && max !== undefined
      ? `${min} – ${max}`
      : min !== undefined
        ? `от ${min}`
        : max !== undefined
          ? `до ${max}`
          : null

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" className="font-normal" />}>
        <ListFilter />
        {title}
        {label && (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-4" />
            <Badge variant="secondary">
              {label}
              {unit ? ` ${unit}` : ''}
            </Badge>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <NumberInput
              aria-label={`${title}: от`}
              placeholder="от"
              value={min ?? ''}
              onChange={(v) => set([v === '' ? undefined : v, max])}
            />
            <span className="text-muted-foreground text-xs">—</span>
            <NumberInput
              aria-label={`${title}: до`}
              placeholder="до"
              value={max ?? ''}
              onChange={(v) => set([min, v === '' ? undefined : v])}
            />
          </div>
          {label && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => column.setFilterValue(undefined)}
            >
              Снять фильтр
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
