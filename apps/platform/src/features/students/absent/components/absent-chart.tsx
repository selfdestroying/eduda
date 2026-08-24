'use client'

import { useAbsentChartQuery } from '@/src/features/students/absent/queries'
import type { AbsentChartPoint } from '@/src/features/students/absent/types'
import { useAbsentFilters } from '@/src/features/students/absent/use-absent-filters'
import { ymdToLocalDate } from '@/src/lib/timezone'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@repo/ui/components/chart'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { format, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

type View = 'week' | 'month' | 'year'

const VIEW_LABEL: Record<View, string> = { week: 'Неделя', month: 'Месяц', year: 'Год' }

/** Что откладываем по вертикали: число пропусков или потерянные за них деньги. */
type Mode = 'count' | 'money'

const MODE_LABEL: Record<Mode, string> = { count: 'Количество', money: 'Деньги' }

/** Ось денег — компактно: «12,5 тыс.» вместо «12 500» на каждом делении. */
const compactNumber = new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Под самую длинную подпись из обоих режимов — «2,1 млн» при кегле 10. */
const Y_AXIS_WIDTH = 44

/**
 * Вкладки как на входе (`app/auth/_components/sign-in.tsx`): фон активной рисует
 * `TabsIndicator`, поэтому у триггера `data-active:bg-transparent`, а длительность
 * задана явно — в базовом классе `transition-all` без неё, и подпись
 * перекрашивалась бы вдвое быстрее пилюли.
 */
const TAB_TRIGGER_CLASS =
  'text-muted-foreground rounded-[0.5625rem] px-3 text-[0.78125rem] font-semibold duration-(--duration-tab) ease-(--ease-tab) data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent'

/**
 * Столбик — пропуски за период целиком, поделённые на две части. Предупреждённые
 * внизу: они читаются как доля общего, а высота столбика остаётся числом
 * пропусков.
 */
const chartConfig = {
  warned: { label: 'С предупреждением', color: 'var(--chart-2)' },
  unwarned: { label: 'Без предупреждения', color: 'var(--chart-1)' },
  // Цвета те же, что у количества: потери идут в цвет непредупреждённых, спасённое
  // — в цвет предупреждённых, это ровно они и есть, только в рублях. Единицы в
  // подписи — тултип и легенда показывают голое число.
  lost: { label: 'Потеряно родителями, ₽', color: 'var(--chart-1)' },
  saved: { label: 'Спасено отработкой, ₽', color: 'var(--chart-2)' },
} satisfies ChartConfig

/**
 * Ключ корзины. Год и месяц — префиксы даты: `YYYY-MM-DD` отрезается без разбора.
 * Неделя так не берётся, поэтому ключ — её понедельник, тоже `YYYY-MM-DD`.
 *
 * Ключи всех трёх видов упорядочены лексикографически так же, как хронологически,
 * и монотонны по дате — значит корзины ложатся в Map в порядке прихода точек, и
 * сортировать их отдельно не нужно.
 */
function bucketKey(date: string, view: View) {
  if (view === 'year') return date.slice(0, 4)
  if (view === 'month') return date.slice(0, 7)
  return format(startOfWeek(ymdToLocalDate(date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

function bucketLabel(key: string, view: View) {
  if (view === 'year') return key
  // Месяцу дописываем первое число: `ymdToLocalDate` ждёт полную дату. У недели
  // ключ уже полный — это её понедельник, его и показываем.
  const date = ymdToLocalDate(view === 'month' ? `${key}-01` : key)
  return format(date, view === 'month' ? 'LLL yy' : 'd MMM yy', { locale: ru })
}

export default function AbsentChart() {
  const [view, setView] = useState<View>('week')
  const [mode, setMode] = useState<Mode>('count')
  // Тот же отбор, что у таблицы под графиком: период и фильтры тулбара живут в
  // адресной строке, поэтому хук зовём свой, а видим одно и то же.
  const { filters } = useAbsentFilters()
  const { data: points = [], isPending, isError } = useAbsentChartQuery(filters)

  const buckets = useMemo(() => {
    // Точки приходят с сервера по возрастанию даты, поэтому корзины ложатся в Map
    // сразу в нужном порядке и сортировать их ещё раз незачем.
    //
    // Складываем оба режима, а не только показанный: переключение штук на рубли
    // тогда идёт без пересчёта, а два лишних сложения на корзину ничего не стоят.
    const counts = new Map<string, Omit<AbsentChartPoint, 'date'>>()
    for (const point of points) {
      const key = bucketKey(point.date, view)
      const bucket = counts.get(key) ?? { warned: 0, unwarned: 0, lost: 0, saved: 0 }
      bucket.warned += point.warned
      bucket.unwarned += point.unwarned
      bucket.lost += point.lost
      bucket.saved += point.saved
      counts.set(key, bucket)
    }
    return [...counts].map(([key, bucket]) => ({ label: bucketLabel(key, view), ...bucket }))
  }, [points, view])

  const isMoney = mode === 'money'

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>Динамика пропусков</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(String(value) as Mode)}>
            <TabsList className="bg-muted/70 grid grid-cols-2 group-data-horizontal/tabs:h-9">
              <TabsIndicator className="bg-card" />
              {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                <TabsTrigger key={m} value={m} className={TAB_TRIGGER_CLASS}>
                  {MODE_LABEL[m]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={view} onValueChange={(value) => setView(String(value) as View)}>
            {/* h-9 задаём вариантом: базовый `group-data-horizontal/tabs:h-8` специфичнее голого h-9.
              `grid-cols-3` — чтобы вкладки были одной ширины: базовый `inline-flex`
              с `w-fit` даёт каждой свою, по длине подписи. */}
            <TabsList className="bg-muted/70 grid grid-cols-3 group-data-horizontal/tabs:h-9">
              <TabsIndicator className="bg-card" />
              {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
                <TabsTrigger key={v} value={v} className={TAB_TRIGGER_CLASS}>
                  {VIEW_LABEL[v]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-56 w-full" />
        ) : isError ? (
          <div className="text-destructive text-sm">Ошибка при загрузке пропусков.</div>
        ) : buckets.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">Нет пропусков.</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                tickMargin={4}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                allowDecimals={false}
                tickFormatter={(value: number) =>
                  isMoney ? compactNumber.format(value) : String(value)
                }
                // Одна ширина на оба режима: recharts отдаёт остаток области
                // столбикам, и ось, сузившаяся под короткие подписи, сдвигала бы
                // весь график при каждом переключении.
                width={Y_AXIS_WIDTH}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    // Итог приписываем к заголовку только у количества: там
                    // сегменты — части одного столбика, и складывать их глазами
                    // незачем. В деньгах ряды соседние, и их сумма — величина, за
                    // которой никто не приходил.
                    labelFormatter={(label, payload) =>
                      isMoney || payload.length < 2
                        ? String(label)
                        : `${label} — всего ${payload.reduce((sum, item) => sum + Number(item.value ?? 0), 0)}`
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {/* Каждый ряд — отдельным потомком, без общей обёртки: recharts 2.x
                  ищет их среди `children` по типу и во фрагмент не заглядывает —
                  завёрнутые в него столбики просто не рисуются.

                  `key` обязателен: без него recharts клеит свой, по порядку
                  (`item-0`, `item-1`), и при смене режима React переиспользует
                  инстанс первого ряда вместо того, чтобы смонтировать новый, —
                  анимация появления тогда играет только в одну сторону. */}
              {/* Деньги — двумя столбиками рядом, а не стеком: потерянное и
                  спасённое не части одного целого, и складывать их незачем. */}
              {isMoney && <Bar key="lost" dataKey="lost" fill="var(--color-lost)" radius={4} />}
              {isMoney && <Bar key="saved" dataKey="saved" fill="var(--color-saved)" radius={4} />}
              {!isMoney && (
                <Bar
                  key="warned"
                  dataKey="warned"
                  stackId="absences"
                  fill="var(--color-warned)"
                  radius={[0, 0, 4, 4]}
                />
              )}
              {!isMoney && (
                <Bar
                  key="unwarned"
                  dataKey="unwarned"
                  stackId="absences"
                  fill="var(--color-unwarned)"
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
