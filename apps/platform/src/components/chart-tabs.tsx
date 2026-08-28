'use client'

import { cn } from '@/src/lib/utils'
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '@repo/ui/components/tabs'

/**
 * Вкладки как на входе (`app/auth/_components/sign-in.tsx`): фон активной рисует
 * `TabsIndicator`, поэтому у триггера `data-active:bg-transparent`, а длительность
 * задана явно — в базовом классе `transition-all` без неё, и подпись
 * перекрашивалась бы вдвое быстрее пилюли.
 */
const TRIGGER_CLASS =
  'text-muted-foreground px-2.5 font-semibold duration-(--duration-tab) ease-(--ease-tab) data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent'

/**
 * Ширина колонок — статикой, по числу вкладок: Tailwind собирает классы из
 * исходника, и `grid-cols-${n}` в сборку не попадает.
 */
const COLUMNS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3' }

/**
 * Переключатель разреза над графиком. Вкладки берутся из карты подписей, а не из
 * пропса-массива: ключи — это и есть значения, и разъехаться им негде.
 */
export default function ChartTabs<T extends string>({
  value,
  onValueChange,
  labels,
}: {
  value: T
  onValueChange: (next: T) => void
  labels: Record<T, string>
}) {
  const keys = Object.keys(labels) as T[]
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(String(next) as T)}
      className="w-full sm:w-auto"
    >
      {/* `h-7` — высота `Button` по умолчанию, чтобы шапка шла по одной линии
          с кнопками; задаём вариантом, иначе базовый
          `group-data-horizontal/tabs:h-8` окажется специфичнее. `grid` — чтобы
          вкладки были одной ширины: базовый `inline-flex` с `w-fit` даёт каждой
          свою, по длине подписи. */}
      <TabsList
        className={cn(
          'bg-muted/70 grid w-full group-data-horizontal/tabs:h-7 sm:w-fit',
          COLUMNS[keys.length],
        )}
      >
        <TabsIndicator className="bg-card" />
        {keys.map((key) => (
          <TabsTrigger key={key} value={key} className={TRIGGER_CLASS}>
            {labels[key]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
