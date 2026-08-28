'use client'

import ChartTabs from '@/src/components/chart-tabs'
import {
  MAX_BUCKETS,
  VIEW_LABEL,
  bucketKey,
  bucketLabel,
  nextBucketKey,
  type View,
} from '@/src/lib/chart-buckets'
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
import { useEnrollmentChartQuery } from '../queries'
import { useEnrollmentFilters } from '../use-enrollment-filters'

/**
 * Что откладываем по вертикали. Обе величины считают записи «ученик — группа», но
 * отвечают на разные вопросы: «Новые» — сколько начало заниматься в этом периоде,
 * «Активные» — сколько занималось в нём вообще.
 *
 * «Активные» здесь — не статус `ACTIVE` и не то же, что список под графиком: в
 * марте сюда попадает и тот, кого отчислили в апреле. Считается по фактическим
 * урокам, потому что истории статусов в базе нет.
 */
type Mode = 'enrolled' | 'studied'

const MODE_LABEL: Record<Mode, string> = { enrolled: 'Новые', studied: 'Активные' }

/**
 * Ряд один в обоих режимах, поэтому подпись и цвет меняются вместе с режимом, а
 * `dataKey` остаётся `count` — легенды нет, различать столбику нечего.
 */
const CHART_CONFIG: Record<Mode, ChartConfig> = {
  enrolled: { count: { label: 'Новые', color: 'var(--chart-1)' } },
  studied: { count: { label: 'Активные', color: 'var(--chart-2)' } },
}

/** Под самую длинную подпись оси при кегле 10 — счёт записей за месяц. */
const Y_AXIS_WIDTH = 32

interface EnrollmentsChartProps {
  /** Тот же id, что у таблицы под графиком: период и фильтры у них общие. */
  tableId: string
}

export default function EnrollmentsChart({ tableId }: EnrollmentsChartProps) {
  // Месяц, а не неделя: приход считают месяцами, и на недельном разрезе почти
  // каждый столбик — единица.
  const [view, setView] = useState<View>('month')
  const [mode, setMode] = useState<Mode>('enrolled')
  // Тот же отбор, что у таблицы под графиком: фильтры тулбара живут в адресной
  // строке, поэтому хук зовём свой, а видим одно и то же.
  const { filters } = useEnrollmentFilters({ id: tableId })

  const isStudied = mode === 'studied'
  /**
   * Оба ряда приходят вместе: считаются они из одних строк посещаемости, и
   * переключение режима поэтому на сервер не ходит.
   *
   * Периода здесь нет, хотя `filters` его несёт, а схема принимает: задать его на
   * этой странице больше нечем — проваливание по клику убрано, а из тулбара
   * таблицы период ушёл вместе с ним. Оставить значило бы молча сужать график по
   * `?from`/`?to` из старой ссылки, ничего об этом не написав.
   */
  const { data, isPending, isError } = useEnrollmentChartQuery({
    view,
    search: filters.search,
    courseIds: filters.courseIds,
    locationIds: filters.locationIds,
    teacherIds: filters.teacherIds,
  })

  /**
   * Разрез, которым сложены нарисованные корзины, — он же единственный, которым
   * их ключи можно прочитать. Пока грузится новый, `keepPreviousData` показывает
   * прошлые корзины, и ключи у них ещё старого вида. Читать их текущим — это
   * `bucketLabel('2025-09', 'week')` и падение графика на `Invalid time value`.
   */
  const bucketView = data?.view ?? view

  const buckets = useMemo(() => {
    // «Новые» приходят днями и складываются здесь: у пары «ученик — группа» дата
    // ровно одна, поэтому дни складываются обычным сложением. «Активные» — уже
    // корзинами: пару за месяц нельзя пересчитать из дневных чисел, она приходит
    // восемь раз, а считается один.
    //
    // И то и другое приходит по возрастанию, поэтому корзины ложатся в Map сразу
    // в нужном порядке и сортировать их ещё раз незачем.
    const counts = new Map<string, number>()
    if (isStudied) {
      for (const bucket of data?.studied ?? []) counts.set(bucket.key, bucket.count)
    } else {
      for (const point of data?.enrolled ?? []) {
        const key = bucketKey(point.date, bucketView)
        counts.set(key, (counts.get(key) ?? 0) + point.count)
      }
    }

    // Пустые периоды рисуем нулём, а не пропускаем: летний провал — это факт, и
    // на склеенном ряде его не видно. Ключ едет вместе с корзиной: по нему клик
    // считает границы периода.
    const keys = [...counts.keys()]
    const last = keys.at(-1)
    const filled: { key: string; label: string; count: number }[] = []
    for (
      let key = keys[0];
      key !== undefined && key <= last!;
      key = nextBucketKey(key, bucketView)
    ) {
      filled.push({ key, label: bucketLabel(key, bucketView), count: counts.get(key) ?? 0 })
    }
    return filled
  }, [isStudied, data, bucketView])

  // Ширина решает, сколько столбиков влезет. `useIsMobile` на сервере отдаёт
  // `false`, так что первый рендер считает экран широким, а телефон получает своё
  // окно сразу после гидрации — пересчёт дешёвый, это срез готового массива.
  const isMobile = useIsMobile()
  const visible = buckets.slice(-(isMobile ? MAX_BUCKETS.mobile : MAX_BUCKETS.desktop))

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>Сводка</CardTitle>
        {/* На узком экране каждая группа занимает свою строку целиком: втроём с
            заголовком они в 375 px не помещаются, а ужатые до половины вкладки
            обрезают «Неделя» — подписи `whitespace-nowrap` не переносятся. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ChartTabs value={mode} onValueChange={setMode} labels={MODE_LABEL} />
          <ChartTabs value={view} onValueChange={setView} labels={VIEW_LABEL} />
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-56 w-full" />
        ) : isError ? (
          <div className="text-destructive text-sm">Ошибка при загрузке учеников.</div>
        ) : buckets.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">Нет учеников.</div>
        ) : (
          <ChartContainer config={CHART_CONFIG[mode]} className="h-56 w-full">
            <BarChart data={visible} margin={{ top: 8, right: 8, bottom: 0 }}>
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
              {/* Легенды нет: ряд один, и подписывать в ней нечего — цвет
                  столбика ничего не различает.

                  `key` по режиму обязателен: без него React переиспользует
                  инстанс ряда вместо того, чтобы смонтировать новый, — анимация
                  появления тогда играет только в одну сторону. */}
              <Bar key={mode} dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
