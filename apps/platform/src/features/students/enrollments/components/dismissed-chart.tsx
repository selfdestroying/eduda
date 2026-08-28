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
import { cn } from '@/src/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@repo/ui/components/chart'
import { Skeleton } from '@repo/ui/components/skeleton'
import { useIsMobile } from '@repo/ui/hooks/use-mobile'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useEnrollmentStatusPointsQuery } from '../queries'
import { useEnrollmentFilters } from '../use-enrollment-filters'

/** Страница показывает только отчисленных; человек этот отбор не меняет. */
const STATUSES = ['DISMISSED'] as const

/** Ряд один, легенды нет — различать столбику нечего. */
const CHART_CONFIG = {
  count: { label: 'Отчислено', color: 'var(--chart-1)' },
} satisfies ChartConfig

/** Под самую длинную подпись оси при кегле 10 — счёт отчислений за месяц. */
const Y_AXIS_WIDTH = 32

interface DismissedChartProps {
  /** Тот же id, что у таблицы под графиком: период и фильтры у них общие. */
  tableId: string
}

/**
 * Отчисления по времени. Отбор общий с таблицей под ним и живёт в адресной
 * строке, поэтому столбик и строки под ним считают одни и те же записи.
 */
export default function DismissedChart({ tableId }: DismissedChartProps) {
  // Месяц, а не неделя: отток считают месяцами, и на недельном разрезе почти
  // каждый столбик — единица.
  const [view, setView] = useState<View>('month')
  // Тот же отбор, что у таблицы: период и фильтры тулбара живут в адресной
  // строке, поэтому хук зовём свой, а видим одно и то же.
  const { t, filters } = useEnrollmentFilters({ id: tableId })
  const {
    data: points = [],
    isPending,
    isError,
  } = useEnrollmentStatusPointsQuery({ ...filters, statuses: [...STATUSES] })

  const buckets = useMemo(() => {
    // Точки приходят с сервера по возрастанию даты, поэтому корзины ложатся в
    // Map сразу в нужном порядке и сортировать их ещё раз незачем.
    const counts = new Map<string, number>()
    for (const point of points) {
      const key = bucketKey(point.date, view)
      counts.set(key, (counts.get(key) ?? 0) + point.count)
    }

    // Пустые периоды рисуем нулём, а не пропускаем: месяц без единого отчисления
    // — это факт, и на склеенном ряде его не видно вовсе. Ключ едет вместе с
    // корзиной: по нему клик считает границы периода.
    const keys = [...counts.keys()]
    const last = keys.at(-1)
    const filled: { key: string; label: string; count: number }[] = []
    for (let key = keys[0]; key !== undefined && key <= last!; key = nextBucketKey(key, view)) {
      filled.push({ key, label: bucketLabel(key, view), count: counts.get(key) ?? 0 })
    }
    return filled
  }, [points, view])

  // Ширина решает, сколько столбиков влезет. `useIsMobile` на сервере отдаёт
  // `false`, так что первый рендер считает экран широким, а телефон получает своё
  // окно сразу после гидрации — пересчёт дешёвый, это срез готового массива.
  const isMobile = useIsMobile()
  const visible = buckets.slice(-(isMobile ? MAX_BUCKETS.mobile : MAX_BUCKETS.desktop))

  /**
   * Клик по столбику ставит период тулбара на эту корзину и проваливается на
   * разрез мельче: год раскрывается месяцами, месяц — неделями. Отбор общий с
   * таблицей, так что она сужается заодно.
   *
   * Клик мимо столбика recharts тоже отдаёт сюда, но без `activePayload` — такой
   * игнорируем, иначе промах сбрасывал бы период.
   *
   * На телефоне не проваливаемся вовсе: касание там — это сразу и наведение, и
   * клик, так что один тап показал бы цифры и тут же сменил их на другие. Период
   * на узком экране задают через тулбар таблицы.
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
        <CardTitle>Сводка</CardTitle>
        <ChartTabs value={view} onValueChange={setView} labels={VIEW_LABEL} />
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-56 w-full" />
        ) : isError ? (
          <div className="text-destructive text-sm">Ошибка при загрузке отчисленных.</div>
        ) : buckets.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">Нет отчислений.</div>
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
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
                width={Y_AXIS_WIDTH}
              />
              <ChartTooltip
                // Подсветка колонки под курсором — заливку `.recharts-tooltip-cursor`
                // задаёт сам `ChartContainer`, здесь достаточно её не выключать.
                cursor
                content={<ChartTooltipContent indicator="dot" />}
              />
              {/* Ряд — прямым потомком, без обёртки: recharts ищет ряды среди
                  `children` по типу и во фрагмент не заглядывает. */}
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
