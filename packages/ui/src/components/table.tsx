'use client'

import * as React from 'react'

import { cn } from '@repo/ui/lib/utils'

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-xs', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Высота строки задаётся ячейкой, а не её содержимым: 40px, столько же, сколько у
 * заголовка (`TableHead h-10`).
 *
 * Иначе строка получалась ровно такой, что в неё положили: текст (`text-xs`, 16px)
 * давал 32px, бейдж (`h-5`) — 36px, иконочная кнопка (`size-7`) — 44px. Соседние
 * таблицы выходили разной плотности, а одна и та же таблица меняла высоту при
 * переключении режима или на короткой последней странице.
 *
 * Отсюда правило: **в ячейку кладут содержимое не выше 32px** — бейдж (20),
 * подсказку (24), иконочную кнопку (28), поле ввода (28). Всё это садится в 40px
 * вместе с `py-1`, и строка не шевелится.
 *
 * `h-10` — минимум, а не потолок: намеренно многострочная ячейка (расписание
 * группы) строку растит, и это законно. Своя высота в `className` перебивает
 * базовую — так пустое состояние остаётся на `h-24`.
 */
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'h-10 px-2 py-1 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-xs', className)}
      {...props}
    />
  )
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow }
