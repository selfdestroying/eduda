'use client'

import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { Input } from '@repo/ui/components/input'
import { NumberInput } from '@repo/ui/components/number-input'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'
import { Slider } from '@repo/ui/components/slider'
import { cn } from '@repo/ui/lib/utils'
import type { Column, RowData, Table as TanstackTable } from '@tanstack/react-table'
import { ListFilter, Search, X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

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
  const isFiltered = table.getState().columnFilters.length > 0 || Boolean(search) || hasExtraFilters

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
 * Мультиселект — тем же меню с галочками, что и «Колонки», и с тем же счётчиком
 * «выбрано/всего» на кнопке. Раньше выбранное перечислялось бейджами с названиями,
 * и строка фильтров расползалась тем сильнее, чем больше выбрано.
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="shrink-0" />}>
        <ListFilter />
        {title}
        {/* Только когда что-то выбрано: у фильтра «ничего не выбрано» — обычное
            состояние, и счётчик в нём ничего не сообщает. */}
        {selected.size > 0 && (
          <span className="text-muted-foreground tabular-nums">
            {selected.size}/{options.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {options.length === 0 ? (
          <p className="text-muted-foreground p-2 text-xs">Нет вариантов.</p>
        ) : (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selected.has(option.value)}
              onCheckedChange={() => toggle(option.value)}
              closeOnClick={false}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const bounds = column.columnDef.meta?.range
  const step = column.columnDef.meta?.step ?? 1
  const [min, max] = (column.getFilterValue() as [number?, number?] | undefined) ?? []

  const set = (next: [number | undefined, number | undefined]) =>
    // Обе границы пусты — фильтра нет: иначе он висел бы в URL и в счётчике,
    // ничего не отбирая.
    column.setFilterValue(next[0] === undefined && next[1] === undefined ? undefined : next)

  const [low, high] = bounds ?? []

  // Значение вне объявленной шкалы ползунок показать не может: ручка упрётся в
  // край, а первое же касание пришлёт `onValueCommitted` из своего диапазона и
  // молча затрёт введённое. Поэтому при таком значении показываем только поля.
  const outOfBounds =
    low === undefined ||
    high === undefined ||
    (min !== undefined && (min < low || min > high)) ||
    (max !== undefined && (max < low || max > high))

  // Ползунок ведёт свою копию значения: `onValueChange` сыплется на каждый пиксель
  // перетаскивания, а каждая запись фильтра — это адрес и запрос к серверу. В
  // фильтр уходит только `onValueCommitted`, то есть отпущенная мышь.
  const [draft, setDraft] = useState<number[]>([min ?? low ?? 0, max ?? high ?? 0])
  useEffect(() => {
    if (low !== undefined && high !== undefined) setDraft([min ?? low, max ?? high])
    // Зависимости — числа, а не массив `bounds`: у каллера, объявляющего колонки
    // инлайном, он новый на каждый рендер, и эффект гонял бы `setDraft` по кругу.
  }, [min, max, low, high])

  const commit = (next: number | readonly number[]) => {
    if (!Array.isArray(next)) return
    const [from, to] = next as [number, number]
    // Ручка у самого края значит «без ограничения с этой стороны»: иначе фильтр
    // висел бы всегда, отбирая всё подряд.
    set([from === low ? undefined : from, to === high ? undefined : to])
  }

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
      {/* Значение — приглушённым текстом, как счётчик у мультиселекта: иначе один
          фильтр в строке выглядел бы бейджем, а другой числом. */}
      <PopoverTrigger render={<Button variant="outline" className="shrink-0" />}>
        <ListFilter />
        {title}
        {label && (
          <span className="text-muted-foreground tabular-nums">
            {label}
            {unit ? ` ${unit}` : ''}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="flex flex-col gap-3">
          {!outOfBounds && (
            <Slider
              min={low}
              max={high}
              step={step}
              value={draft}
              onValueChange={(v) => setDraft(Array.isArray(v) ? v : [v])}
              onValueCommitted={commit}
              aria-label={title}
            />
          )}
          {/* Поля остаются и при ползунке: шкала у него объявленная, а значение
              за её пределами всё равно надо уметь ввести. */}
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
