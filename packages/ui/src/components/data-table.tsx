'use client'

import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { Label } from '@repo/ui/components/label'
import { Separator } from '@repo/ui/components/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'
import { cn } from '@repo/ui/lib/utils'
import {
  flexRender,
  type Row,
  type RowData,
  type Table as TanstackTable,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Loader,
} from 'lucide-react'
import { type ReactNode } from 'react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@repo/ui/components/empty'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * Подпись колонки для меню видимости. Отдельно от `header`, потому что тот
     * сплошь и рядом JSX с иконкой-подсказкой — в пункт меню его не положишь.
     * Колонка без `title` в меню не попадает и спрятать её нельзя (действия).
     */
    title?: string
    /** Классы на ячейку и заголовок колонки — выключка, ширина, `tabular-nums`. */
    className?: string
    /**
     * Тип фильтра для `DataTableToolbar`. Колонка без `variant` в тулбар не
     * попадает — так фильтры описываются один раз, рядом с колонкой, вместо
     * пропса, парсера, хендлера и своей ветки разметки на каждый.
     */
    variant?: 'multiSelect' | 'range'
    /** Варианты для `multiSelect`. `value` — строка: она едет в URL. */
    options?: Array<{ label: string; value: string }>
    /** Подпись единиц у `range` — «₽», «уроков». */
    unit?: string
    /**
     * Колонка тянется: ей не пишется `width`, и по алгоритму фиксированной
     * раскладки свободная ширина делится поровну между всеми такими колонками.
     *
     * Если гибких колонок нет ни одной, таблица не растягивается на всю ширину
     * контейнера, а встаёт ровно на сумму `size` — тогда каждая колонка получает
     * заявленную ширину, а свободное место остаётся справа. Это честнее, чем
     * впихивать излишек в колонку, которой он не нужен.
     *
     * Второе применение — задать ширину самому, классом в `className`: инлайновый
     * `width` перебил бы его, а с этим флагом его просто нет. Так делают проценты
     * (`w-[30%]`), которых `size` в пикселях не выражает; `size` тогда остаётся
     * только вкладом в порог горизонтальной прокрутки.
     */
    flexible?: boolean
  }
}

interface DataTableProps<TData> {
  table: TanstackTable<TData>
  /** Текст пустого состояния */
  emptyMessage?: string
  /** Показывать ли пагинацию */
  showPagination?: boolean
  /** Слот для тулбара (поиск, фильтры и т.д.) */
  toolbar?: ReactNode
  /**  */
  isLoading?: boolean
  /**
   * Меню «Колонки» справа от тулбара. Требует, чтобы таблица держала
   * `columnVisibility` в состоянии — иначе переключать будет нечего.
   */
  showColumnVisibility?: boolean
  /**
   * Данные обновляются, но прежние уже показаны: таблица приглушается вместо того,
   * чтобы моргнуть скелетоном. Для серверных таблиц — состояние между страницами.
   */
  isRefreshing?: boolean
  /** Классы на строку — приглушить отменённое, подсветить просроченное. */
  rowClassName?: (row: Row<TData>) => string | undefined
}

/**
 * Заголовок сортируемой колонки — это flex-контейнер (текст плюс стрелка), и
 * выключку из `text-*` он сам не унаследует: её нужно перевести в `justify-*`,
 * иначе заголовок встанет слева от центрированных или прижатых вправо значений.
 * Для колонок по левому краю остаётся `w-fit`, чтобы клик по сортировке
 * ограничивался текстом, а не всей шириной колонки.
 */
function headerJustify(className?: string) {
  if (className?.includes('text-right')) return 'justify-end'
  if (className?.includes('text-center')) return 'justify-center'
  return 'w-fit'
}

export default function DataTable<TData>({
  table,
  emptyMessage = 'Нет данных.',
  showPagination = false,
  toolbar,
  isLoading = false,
  showColumnVisibility = false,
  isRefreshing = false,
  rowClassName,
}: DataTableProps<TData>) {
  // Именно видимые: скрытая колонка не рисуется, и colSpan по всем растянул бы
  // пустое состояние шире таблицы. Минимум единица — скрыть можно все колонки
  // сразу, а `colSpan={0}` браузер понимает как «до конца группы строк».
  const columnCount = Math.max(1, table.getVisibleLeafColumns().length)

  // Есть ли кому забрать свободную ширину. Нет — таблицу не растягиваем: при
  // `table-layout: fixed` и `width: auto` браузер всё равно тянет её до ширины
  // контейнера, поэтому ширину приходится задавать явно.
  const hasFlexibleColumn = table
    .getVisibleLeafColumns()
    .some((column) => column.columnDef.meta?.flexible)
  const totalSize = table.getTotalSize()

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Один переносящийся ряд, а не колонка на узком и строка на широком: при
          `flex-col` кнопка «Колонки» растягивалась во всю ширину экрана, потому что
          по умолчанию элементы колонки тянутся по поперечной оси. `ml-auto` прижимает
          её вправо и когда она рядом с фильтрами, и когда перенеслась на свою
          строку, — `justify-between` для одиночного элемента на строке не сработал бы. */}
      {showColumnVisibility ? (
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <DataTableViewOptions table={table} className="ml-auto" />
        </div>
      ) : (
        toolbar
      )}
      {/* `table-fixed`: без него `width` на ячейке для браузерного auto-алгоритма
          лишь подсказка, и колонка всё равно растягивается под содержимое — ширины
          прыгают от страницы к странице. Здесь, а не в самом `Table`: его собирают
          руками и в других местах, где сетка по содержимому как раз нужна.
          Числа `size` — пиксели; свободную ширину забирают колонки с
          `meta.flexible`, а без них таблица просто не растягивается.

          `minWidth` по сумме колонок: без него на узком экране колонки сжимались бы
          до нечитаемых огрызков вместо горизонтальной прокрутки, которую даёт
          обёртка `Table`. */}
      <Table
        className={cn('table-fixed transition-opacity', isRefreshing && 'opacity-60')}
        style={{ minWidth: totalSize, width: hasFlexibleColumn ? undefined : totalSize }}
      >
        <TableHeader className="bg-card sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  // При фиксированной раскладке ширины берутся из первой строки,
                  // остальным задавать их не нужно. Гибкой колонке ширину не пишем
                  // вовсе — ей достанется вся свободная.
                  style={
                    header.column.columnDef.meta?.flexible ? undefined : { width: header.getSize() }
                  }
                  className={header.column.columnDef.meta?.className}
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <div
                      className={cn(
                        header.column.getCanSort() &&
                          'flex cursor-pointer items-center gap-2 select-none',
                        headerJustify(header.column.columnDef.meta?.className),
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(e) => {
                        if (header.column.getCanSort() && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          header.column.getToggleSortingHandler()?.(e)
                        }
                      }}
                      tabIndex={header.column.getCanSort() ? 0 : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ArrowUp className="shrink-0 opacity-60" size={16} />,
                        desc: <ArrowDown className="shrink-0 opacity-60" size={16} />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columnCount}>
                <Empty className="w-full">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Loader className="animate-spin" />
                    </EmptyMedia>
                    <EmptyTitle>Получение списка уроков</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={rowClassName?.(row)}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    // `truncate` обязателен именно здесь: при фиксированной сетке
                    // содержимое шире колонки не сжимается, а вылезает за её край.
                    // `overflow: hidden` на `td` работает, на вложенной ссылке —
                    // нет, она инлайновая.
                    className={cn('truncate', cell.column.columnDef.meta?.className)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-24 text-center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {showPagination && <DataTablePagination table={table} />}
    </div>
  )
}

function DataTableViewOptions<TData>({
  table,
  className,
}: {
  table: TanstackTable<TData>
  className?: string
}) {
  const columns = table.getAllColumns().filter((c) => c.getCanHide() && c.columnDef.meta?.title)
  if (columns.length === 0) return null

  const visibleCount = columns.filter((c) => c.getIsVisible()).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className={cn('shrink-0', className)} />}
      >
        <Eye />
        Колонки
        {/* Только когда что-то скрыто: «6/6» рядом с полной таблицей ничего не
            сообщает. */}
        {visibleCount < columns.length && (
          <>
            <Separator orientation="vertical" className="mx-0.5" />
            <span className="text-muted-foreground tabular-nums">
              {visibleCount}/{columns.length}
            </span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(checked) => column.toggleVisibility(checked)}
            closeOnClick={false}
          >
            {column.columnDef.meta?.title}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DataTablePagination<TData>({ table }: { table: TanstackTable<TData> }) {
  return (
    <div className="flex items-center justify-end">
      <div className="flex w-full items-center gap-4 md:w-fit">
        <div className="hidden items-center gap-2 md:flex">
          <Label htmlFor="rows-per-page" className="text-muted-foreground">
            Строк на страницу:
          </Label>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger id="rows-per-page">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Label className="text-muted-foreground flex w-fit items-center justify-center">
            Страница {table.getState().pagination.pageIndex + 1} из {table.getPageCount()}
          </Label>
          <Button
            variant="outline"
            className="hidden md:flex"
            size="icon"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">На первую страницу</span>
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">На предыдущую страницу</span>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">На следующую страницу</span>
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            className="hidden md:flex"
            size="icon"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">На последнюю страницу</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
