'use client'

import { Button } from '@repo/ui/components/button'
import { Checkbox } from '@repo/ui/components/checkbox'
import { Input } from '@repo/ui/components/input'
import { NumberInput } from '@repo/ui/components/number-input'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import { Separator } from '@repo/ui/components/separator'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/ui/components/drawer'
import { useIsMobile } from '@repo/ui/hooks/use-mobile'
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

/**
 * Сколько названий фильтров помещается на кнопке до «+N». Третье уже уводит
 * кнопку в перенос строки на узком экране.
 */
const VISIBLE_FILTER_TITLES = 2

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
  const isMobile = useIsMobile()

  const activeFilterCount = table.getState().columnFilters.length

  // Сброс предлагаем, только когда есть что сбрасывать: пустая кнопка «Сбросить»
  // рядом с чистой таблицей — шум.
  const isFiltered = activeFilterCount > 0 || Boolean(search) || hasExtraFilters

  // Включённые фильтры называем поимённо: панель закрыта, и цифра «2» на кнопке
  // не говорит, по чему именно отобрано, — а таблица показывает подмножество, и
  // не заметить этого на странице с деньгами дороже всего остального.
  const activeTitles = table
    .getState()
    .columnFilters.map(({ id }) => table.getColumn(id))
    .filter((column) => column !== undefined)
    .map(columnTitle)

  const filters = filterableColumns.map((column) =>
    column.columnDef.meta?.variant === 'range' ? (
      <DataTableRangeFilter key={column.id} column={column} />
    ) : (
      <DataTableFacetedFilter key={column.id} column={column} />
    ),
  )

  return (
    <div data-slot="table-toolbar" className={cn('flex flex-wrap items-center gap-2', className)}>
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

      {/* Снизу на телефоне, сбоку на остальных — как у фильтров календаря. */}
      <Drawer swipeDirection={isMobile ? 'down' : 'right'} showSwipeHandle={isMobile}>
          <DrawerTrigger render={<Button variant="outline" className="shrink-0" />}>
            <ListFilter />
            Фильтры
            {activeTitles.length > 0 && (
              <>
                <Separator orientation="vertical" className="mx-0.5" />
                <span className="text-muted-foreground max-w-48 truncate">
                  {activeTitles.slice(0, VISIBLE_FILTER_TITLES).join(', ')}
                  {activeTitles.length > VISIBLE_FILTER_TITLES &&
                    ` +${activeTitles.length - VISIBLE_FILTER_TITLES}`}
                </span>
              </>
            )}
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="pb-4">
              <DrawerTitle>Фильтры</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-4 px-4">{filters}</div>
            </ScrollArea>
            <DrawerFooter className="pt-4">
              {onReset && (
                <Button variant="outline" onClick={onReset} disabled={!isFiltered}>
                  <X />
                  Сбросить
                </Button>
              )}
              <DrawerClose render={<Button />}>Готово</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
      </Drawer>
    </div>
  )
}

/** Подпись фильтра: `meta.title`, иначе id — заголовок колонки часто JSX. */
function columnTitle<TData extends RowData>(column: Column<TData, unknown>) {
  return column.columnDef.meta?.title ?? column.id
}

/** Подпись секции — та же, что в панели фильтров календаря. */
const SECTION_TITLE = 'text-muted-foreground mb-2 px-2 text-[11px] font-semibold tracking-wide uppercase'

/**
 * Мультиселект — секцией чекбоксов прямо в панели, без своей выпадашки: панель
 * и так открыта, а меню внутри неё было бы вторым слоем поверх первого ради
 * того же списка галочек.
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
    // Пустой фильтр снимаем целиком, чтобы он исчез и из URL, и с кнопки.
    column.setFilterValue(next.size > 0 ? [...next] : undefined)
  }

  return (
    <div className="flex w-full flex-col">
      <div className={SECTION_TITLE}>{title}</div>
      {options.length === 0 ? (
        <p className="text-muted-foreground/70 px-2 text-[12.5px]">Нет вариантов.</p>
      ) : (
        options.map((option) => {
          const active = selected.has(option.value)
          // Checkbox внутри <label>: клик по всей строке переключает галочку.
          return (
            <label
              key={option.value}
              className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors"
            >
              <Checkbox checked={active} onCheckedChange={() => toggle(option.value)} />
              <span className="flex-1 truncate">{option.label}</span>
            </label>
          )
        })
      )}
    </div>
  )
}

/** Задержка перед записью введённого диапазона в фильтр. */
const RANGE_COMMIT_DELAY_MS = 400

/**
 * Числовой диапазон — двумя полями. Значение фильтра `[min, max]`, любая граница
 * может быть `undefined`: «от 1000» и «до 5000» одинаково законны.
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
    <div className="flex w-full flex-col">
      {/* Единицы в подписи, а не отдельным элементом у полей: в колонке секций
          подпись читается первой, и «Сумма, ₽» отвечает на вопрос сразу. */}
      <div className={SECTION_TITLE}>{unit ? `${title}, ${unit}` : title}</div>
      <div className="flex items-center gap-2 px-2">
        <NumberInput
          aria-label={`${title}: от`}
          placeholder="от"
          value={draftMin}
          onChange={setDraftMin}
        />
        <span className="text-muted-foreground/70">—</span>
        <NumberInput
          aria-label={`${title}: до`}
          placeholder="до"
          value={draftMax}
          onChange={setDraftMax}
        />
      </div>
    </div>
  )
}
