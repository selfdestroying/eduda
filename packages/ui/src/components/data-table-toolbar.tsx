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
import { Separator } from '@repo/ui/components/separator'
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

/** Задержка перед записью введённого диапазона в фильтр. */
const RANGE_COMMIT_DELAY_MS = 400

/** Поле внутри рамки группы: без своей рамки, фона, отступов и кольца фокуса. */
const RANGE_INPUT =
  'h-5 w-14 rounded-none border-0 bg-transparent p-0 text-xs focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent md:text-xs'

/**
 * Числовой диапазон — двумя полями прямо в строке фильтров, без выпадашки.
 * Значение фильтра `[min, max]`, любая граница может быть `undefined`: «от 1000»
 * и «до 5000» одинаково законны.
 */
function DataTableRangeFilter<TData extends RowData>({
  column,
}: {
  column: Column<TData, unknown>
}) {
  const title = columnTitle(column)
  const unit = column.columnDef.meta?.unit
  const [min, max] = (column.getFilterValue() as [number?, number?] | undefined) ?? []

  // Черновик: «12000» — это пять нажатий, и без задержки каждое ушло бы отдельным
  // запросом на сервер. В фильтр пишем, когда ввод затих.
  const [draftMin, setDraftMin] = useState<number | ''>(min ?? '')
  const [draftMax, setDraftMax] = useState<number | ''>(max ?? '')

  // Внешние изменения — «Сбросить», переход по ссылке — подхватываем в черновик.
  useEffect(() => {
    setDraftMin(min ?? '')
    setDraftMax(max ?? '')
  }, [min, max])

  useEffect(() => {
    const nextMin = draftMin === '' ? undefined : draftMin
    const nextMax = draftMax === '' ? undefined : draftMax
    // Черновик уже совпал с фильтром — писать нечего. Без этой проверки эффект
    // синхронизации выше и этот гоняли бы записи по кругу.
    if (nextMin === min && nextMax === max) return

    const timer = setTimeout(() => {
      // Обе границы пусты — фильтра нет: иначе он висел бы в URL и в счётчике,
      // ничего не отбирая.
      column.setFilterValue(
        nextMin === undefined && nextMax === undefined ? undefined : [nextMin, nextMax],
      )
    }, RANGE_COMMIT_DELAY_MS)
    return () => clearTimeout(timer)
    // `column` намеренно вне зависимостей: у каллера, объявляющего колонки инлайном,
    // его объект новый на каждый рендер — таймер сбрасывался бы, не успев сработать,
    // и фильтр не записался бы никогда.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftMin, draftMax, min, max])

  return (
    // Рамка и высота — как у кнопок-фильтров рядом, чтобы два поля не выглядели
    // выпавшими из строки. Обводка при фокусе переезжает на всю группу
    // (`focus-within`), а у полей внутри своя снимается — иначе рамка в рамке.
    <div className="border-border dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/30 flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs transition-colors focus-within:ring-[2px]">
      {/* Та же иконка, что у кнопок-фильтров: без неё группа не читается как
          фильтр, хотя стоит с ними в одном ряду. Размер задан явно — правило
          `[&_svg]:size-3.5` живёт в `Button`, а здесь его нет. */}
      <ListFilter className="size-3.5 shrink-0" />
      <span className="whitespace-nowrap">{title}</span>
      {/* Отделяет неизменяемую подпись от полей ввода: без него «Сумма» читается
          как часть первого поля. */}
      <Separator orientation="vertical" className="mx-0.5" />
      <NumberInput
        aria-label={`${title}: от`}
        placeholder="от"
        className={RANGE_INPUT}
        value={draftMin}
        onChange={setDraftMin}
      />
      <Separator orientation="vertical" className="mx-0.5" />
      <NumberInput
        aria-label={`${title}: до`}
        placeholder="до"
        className={RANGE_INPUT}
        value={draftMax}
        onChange={setDraftMax}
      />

      {/* Единицы после полей, а не в подписи: читается как «от 1000 до 5000 ₽» —
          так же, как это произносят. */}
      {unit && (
        <>
          <Separator orientation="vertical" className="mx-0.5" />
          <span>{unit}</span>
        </>
      )}
    </div>
  )
}
