'use client'

import { useAbsentChartQuery } from '@/src/features/students/absent/queries'
import type { AbsentChartPoint } from '@/src/features/students/absent/types'
import { useAbsentFilters } from '@/src/features/students/absent/use-absent-filters'
import type { Period } from '@/src/hooks/use-table-state'
import { dateToYmd, ymdToLocalDate } from '@/src/lib/timezone'
import { cn } from '@/src/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@repo/ui/components/chart'
import { useIsMobile } from '@repo/ui/hooks/use-mobile'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { addDays, endOfMonth, format, startOfWeek } from 'date-fns'
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
 * Сколько корзин помещается в столбики читаемой ширины. За всю историю их
 * набирается под сотню, и на телефоне каждой достаётся два-три пикселя.
 *
 * Показываем хвост — свежие периоды, за которыми к графику и приходят. Старое
 * никуда не девается: его достают периодом в тулбаре или разрезом покрупнее.
 */
const MAX_BUCKETS = { mobile: 8, desktop: 26 }

/**
 * Вкладки как на входе (`app/auth/_components/sign-in.tsx`): фон активной рисует
 * `TabsIndicator`, поэтому у триггера `data-active:bg-transparent`, а длительность
 * задана явно — в базовом классе `transition-all` без неё, и подпись
 * перекрашивалась бы вдвое быстрее пилюли.
 */
const TAB_TRIGGER_CLASS =
  'text-muted-foreground px-2.5 font-semibold duration-(--duration-tab) ease-(--ease-tab) data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent'

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

/**
 * Границы корзины — тем же форматом `YYYY-MM-DD`, что ждёт фильтр периода. Обе
 * включительно, как и его сравнение.
 */
function bucketRange(key: string, view: View): Period {
  if (view === 'year') return { from: `${key}-01-01`, to: `${key}-12-31` }
  if (view === 'month') {
    return { from: `${key}-01`, to: dateToYmd(endOfMonth(ymdToLocalDate(`${key}-01`))) }
  }
  // Ключ недели — её понедельник, конец — воскресенье.
  return { from: key, to: dateToYmd(addDays(ymdToLocalDate(key), 6)) }
}

/**
 * Куда проваливаться по клику. Год показывает месяцы, месяц — недели, неделя
 * остаётся собой: дробить её на дни график не умеет, да и незачем — с недельным
 * периодом всё видно в таблице под ним.
 */
const NEXT_VIEW: Record<View, View> = { year: 'month', month: 'week', week: 'week' }

export default function AbsentChart() {
  const [view, setView] = useState<View>('week')
  const [mode, setMode] = useState<Mode>('count')
  // Тот же отбор, что у таблицы под графиком: период и фильтры тулбара живут в
  // адресной строке, поэтому хук зовём свой, а видим одно и то же.
  const { t, filters } = useAbsentFilters()
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
    // Ключ едет вместе с корзиной: по нему клик считает границы периода.
    return [...counts].map(([key, bucket]) => ({ key, label: bucketLabel(key, view), ...bucket }))
  }, [points, view])

  const isMoney = mode === 'money'

  // Ширина решает, сколько столбиков влезет. `useIsMobile` на сервере отдаёт
  // `false`, так что первый рендер считает экран широким, а телефон получает своё
  // окно сразу после гидрации — пересчёт дешёвый, это срез готового массива.
  const isMobile = useIsMobile()
  const limit = isMobile ? MAX_BUCKETS.mobile : MAX_BUCKETS.desktop
  const visible = buckets.slice(-limit)

  /**
   * Клик по столбику ставит период тулбара на эту корзину и проваливается на
   * разрез мельче: год раскрывается месяцами, месяц — неделями. Отбор общий с
   * таблицей, так что она сужается заодно.
   *
   * Клик мимо столбика recharts тоже отдаёт сюда, но без `activePayload` —
   * такой игнорируем, иначе промах сбрасывал бы период.
   *
   * На телефоне не проваливаемся вовсе: касание там — это сразу и наведение, и
   * клик (recharts ведёт тултип от `onTouchStart`, браузер добавляет `click` на
   * `touchend`), так что один тап показал бы цифры и тут же сменил их на другие.
   * Заодно короткий свайп с графика перестаёт случайно менять период вместо
   * прокрутки. Период на узком экране задают через тулбар таблицы.
   */
  const drillDown = (state: { activePayload?: { payload?: unknown }[] } | null) => {
    if (isMobile) return
    const bucket = state?.activePayload?.[0]?.payload as (typeof visible)[number] | undefined
    if (!bucket) return
    t.setPeriod(bucketRange(bucket.key, view))
    setView(NEXT_VIEW[view])
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>Динамика пропусков</CardTitle>
        {/* На узком экране каждая группа занимает свою строку целиком: втроём с
            заголовком они в 375 px не помещаются, а ужатые до половины вкладки
            обрезают «Неделя» — подписи `whitespace-nowrap` не переносятся. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(String(value) as Mode)}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-muted/70 grid w-full grid-cols-2 group-data-horizontal/tabs:h-7 sm:w-fit">
              <TabsIndicator className="bg-card" />
              {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                <TabsTrigger key={m} value={m} className={TAB_TRIGGER_CLASS}>
                  {MODE_LABEL[m]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs
            value={view}
            onValueChange={(value) => setView(String(value) as View)}
            className="w-full sm:w-auto"
          >
            {/* `h-7` — высота `Button` по умолчанию, чтобы шапка шла по одной линии
                с кнопками; задаём вариантом, иначе базовый
                `group-data-horizontal/tabs:h-8` окажется специфичнее. `grid-cols-3`
                — чтобы вкладки были одной ширины: базовый `inline-flex` с `w-fit`
                даёт каждой свою, по длине подписи. */}
            <TabsList className="bg-muted/70 grid w-full grid-cols-3 group-data-horizontal/tabs:h-7 sm:w-fit">
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
          <ChartContainer
            config={chartConfig}
            // Курсор через `!`: recharts пишет `cursor: default` инлайном на
            // обёртке, и обычный класс до него не достаёт. На узком экране его
            // нет — там и проваливаться по клику некуда.
            className={cn('h-56 w-full', !isMobile && '[&_.recharts-wrapper]:cursor-pointer!')}
          >
            <BarChart data={visible} margin={{ top: 8, right: 8, bottom: 0 }} onClick={drillDown}>
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
                // Подсветка колонки под курсором — заливку `.recharts-tooltip-cursor`
                // задаёт сам `ChartContainer`, здесь достаточно её не выключать.
                cursor
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
