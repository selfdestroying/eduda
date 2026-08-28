'use client'

import ChartTabs from '@/src/components/chart-tabs'
import {
  MAX_BUCKETS,
  NEXT_VIEW,
  VIEW_LABEL,
  bucketKey,
  bucketLabel,
  bucketRange,
  nextBucketKey,
  type View,
} from '@/src/lib/chart-buckets'
import { cn, formatCurrency } from '@/src/lib/utils'
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
import { StatCard } from '@repo/ui/components/stat-card'
import { useIsMobile } from '@repo/ui/hooks/use-mobile'
import { CalendarCheck, CircleDollarSign, Clock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useRevenueChartQuery } from '../queries'
import { useRevenueFilters } from '../use-revenue-filters'

/**
 * Что откладываем по вертикали. Оба ряда считаются из одних и тех же занятий, но
 * отвечают на разные вопросы: «Выручка» — сколько денег принёс период,
 * «Занятия» — сколько занятий его составило и сколько из них ещё ждут оплаты.
 */
type Mode = 'revenue' | 'lessons'

const MODE_LABEL: Record<Mode, string> = { revenue: 'Выручка', lessons: 'Занятия' }

/**
 * Единица измерения — в подписи ряда, а не в форматере тултипа: свой форматер
 * заменяет строку тултипа целиком, вместе с квадратиком цвета.
 */
const CHART_CONFIG: Record<Mode, ChartConfig> = {
  revenue: { revenue: { label: 'Выручка, ₽', color: 'var(--chart-2)' } },
  lessons: {
    paid: { label: 'Оплачено', color: 'var(--chart-2)' },
    unpaid: { label: 'Ждут оплаты', color: 'var(--chart-1)' },
  },
}

/** Под самую длинную подпись оси при кегле 10: рубли тысячами и счёт занятий. */
const Y_AXIS_WIDTH: Record<Mode, number> = { revenue: 44, lessons: 32 }

const EMPTY_BUCKET = { revenue: 0, paid: 0, unpaid: 0 }

/**
 * Ось в тысячах: выручка месяца — это шесть знаков, и полными числами подписи
 * налезают друг на друга. До тысячи показываем как есть — у дня столько и бывает.
 */
const formatMoneyTick = (value: number) =>
  value >= 1000 ? `${Math.round(value / 1000)} тыс` : String(value)

export default function RevenueChart() {
  // Месяц, а не неделя: выручку считают месяцами, и закрытый месяц — то, с чем
  // школа сверяется чаще всего.
  const [view, setView] = useState<View>('month')
  const [mode, setMode] = useState<Mode>('revenue')
  // Тот же отбор, что у таблицы под графиком: период и фильтры тулбара живут в
  // адресной строке, поэтому хук зовём свой, а видим одно и то же.
  const { t, filters } = useRevenueFilters()

  const { data, isPending, isError } = useRevenueChartQuery(filters)

  /**
   * Итоги по всему отбору — из тех же дней, что рисует график. Второго запроса
   * за ними не нужно: занятие попадает ровно в один день, поэтому сумма дней и
   * есть сумма отбора, и с высотой столбиков карточки разойтись не могут.
   */
  const totals = useMemo(() => {
    let revenue = 0
    let paid = 0
    let total = 0
    for (const point of data ?? []) {
      revenue += point.revenue
      paid += point.paid
      total += point.total
    }
    return { revenue, paid, unpaid: total - paid }
  }, [data])

  const buckets = useMemo(() => {
    // Дни складываются обычным сложением: выручка дня целиком принадлежит этому
    // дню, поэтому корзина любой крупности — это сумма дневных чисел. Разрез
    // из-за этого меняется без похода на сервер.
    //
    // Дни приходят по возрастанию, поэтому корзины ложатся в Map сразу в нужном
    // порядке и сортировать их ещё раз незачем.
    const sums = new Map<string, typeof EMPTY_BUCKET>()
    for (const point of data ?? []) {
      const key = bucketKey(point.date, view)
      const bucket = sums.get(key) ?? { ...EMPTY_BUCKET }
      bucket.revenue += point.revenue
      bucket.paid += point.paid
      // «Ждут оплаты» — разница между проведёнными и оплаченными: занятие было,
      // а пакета под него ещё нет. Отдельным числом с сервера не приходит,
      // потому что это то же самое.
      bucket.unpaid += point.total - point.paid
      sums.set(key, bucket)
    }

    // Пустые периоды рисуем нулём, а не пропускаем: летний провал — это факт, и
    // на склеенном ряде его не видно. Ключ едет вместе с корзиной: по нему клик
    // считает границы периода.
    const keys = [...sums.keys()]
    const last = keys.at(-1)
    const filled = []
    for (let key = keys[0]; key !== undefined && key <= last!; key = nextBucketKey(key, view)) {
      filled.push({ key, label: bucketLabel(key, view), ...(sums.get(key) ?? EMPTY_BUCKET) })
    }
    return filled
  }, [data, view])

  // Ширина решает, сколько столбиков влезет. `useIsMobile` на сервере отдаёт
  // `false`, так что первый рендер считает экран широким, а телефон получает своё
  // окно сразу после гидрации — пересчёт дешёвый, это срез готового массива.
  const isMobile = useIsMobile()
  const visible = buckets.slice(-(isMobile ? MAX_BUCKETS.mobile : MAX_BUCKETS.desktop))

  /**
   * Клик по столбику ставит период тулбара на эту корзину и проваливается на
   * разрез мельче: год раскрывается месяцами, месяц — неделями. Отбор общий с
   * таблицей, так что она сужается заодно, а вернуться можно её же фильтром
   * периода.
   *
   * Клик мимо столбика recharts тоже отдаёт сюда, но без `activePayload` —
   * такой игнорируем, иначе промах сбрасывал бы период.
   *
   * На телефоне не проваливаемся вовсе: касание там — это сразу и наведение, и
   * клик, так что один тап показал бы цифры и тут же сменил их на другие.
   */
  const drillDown = (state: { activePayload?: { payload?: unknown }[] } | null) => {
    if (isMobile) return
    const bucket = state?.activePayload?.[0]?.payload as (typeof visible)[number] | undefined
    if (!bucket) return
    t.setPeriod(bucketRange(bucket.key, view))
    setView(NEXT_VIEW[view])
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="text-destructive text-sm">Ошибка при загрузке выручки.</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Сводка</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] rounded-lg" />
            ))}
          </div>
        ) : (
          // Все три нейтральные: цвет в этой карточке несёт график, и зелёная с
          // янтарной рядом с фиолетовыми столбиками читались как третья палитра.
          // «Ждут оплаты» не тревожная величина — это просто ещё не пришедшие
          // деньги, и подсвечивать её янтарным было обещанием проблемы.
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <StatCard
              label="Выручка"
              value={formatCurrency(totals.revenue)}
              icon={CircleDollarSign}
              description="Занятия, которые школа уже заработала"
            />
            <StatCard
              label="Занятий в выручке"
              value={totals.paid.toLocaleString('ru-RU')}
              icon={CalendarCheck}
              description={
                totals.paid > 0
                  ? `В среднем ${formatCurrency(Math.round(totals.revenue / totals.paid))} за занятие`
                  : 'За выбранный отбор нет ни одного'
              }
            />
            <StatCard
              label="Ждут оплаты"
              value={totals.unpaid.toLocaleString('ru-RU')}
              icon={Clock}
              hint="Занятия провели, но оплаты под них ещё нет: цена появится вместе с ней, и тогда они войдут в выручку."
              description="В сумму выше не входят"
            />
          </div>
        )}
        {/* Вкладки прямо над графиком, а не в шапке карточки: управляют они им
            одним, а в шапке между ними и графиком оказались бы три карточки.

            На узком экране каждая группа занимает свою строку целиком: ужатые
            до половины вкладки обрезают «Неделя» — подписи `whitespace-nowrap`
            не переносятся. */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <ChartTabs value={mode} onValueChange={setMode} labels={MODE_LABEL} />
          <ChartTabs value={view} onValueChange={setView} labels={VIEW_LABEL} />
        </div>
        {isPending ? (
          <Skeleton className="h-56 w-full" />
        ) : buckets.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">Нет занятий.</div>
        ) : (
          <ChartContainer
            config={CHART_CONFIG[mode]}
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
                width={Y_AXIS_WIDTH[mode]}
                {...(mode === 'revenue' && { tickFormatter: formatMoneyTick })}
              />
              <ChartTooltip
                // Подсветка колонки под курсором — заливку `.recharts-tooltip-cursor`
                // задаёт сам `ChartContainer`, здесь достаточно её не выключать.
                cursor
                content={<ChartTooltipContent indicator="dot" />}
              />
              {/* Каждый ряд — отдельным прямым потомком, без общей обёртки:
                  ряды recharts ищет по типу элемента и разворачивает фрагменты
                  через `react-is@18`, а тот не узнаёт элементы React 19 (символ
                  сменился на `react.transitional.element`). Фрагмент для него
                  просто чужой узел — всё, что внутри, пропадает вместе со
                  шкалой, и график стоит на нулях.

                  `key` по режиму обязателен: без него React переиспользует
                  инстанс ряда вместо того, чтобы смонтировать новый, — анимация
                  появления тогда играет только в одну сторону. */}
              {mode === 'revenue' ? (
                <Bar key="revenue" dataKey="revenue" fill="var(--color-revenue)" radius={4} />
              ) : null}
              {/* Стопкой: занятия периода — это оплаченные плюс ждущие оплаты, и
                  разрыв между ними виден только рядом. Скругление достаётся
                  верхнему сегменту, нижний упирается в ось. */}
              {mode === 'lessons' ? (
                <Bar
                  key="paid"
                  dataKey="paid"
                  stackId="lessons"
                  fill="var(--color-paid)"
                  radius={[0, 0, 4, 4]}
                />
              ) : null}
              {mode === 'lessons' ? (
                <Bar
                  key="unpaid"
                  dataKey="unpaid"
                  stackId="lessons"
                  fill="var(--color-unpaid)"
                  radius={[4, 4, 0, 0]}
                />
              ) : null}
              {/* Легенда нужна только в стопке: в «Выручке» ряд один, и
                  различать столбику нечего. */}
              {mode === 'lessons' ? <ChartLegend content={<ChartLegendContent />} /> : null}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
