'use client'

import { Button } from '@repo/ui/components/button'
import { Calendar } from '@repo/ui/components/calendar'
import { SECTION_TITLE } from '@repo/ui/components/data-table-toolbar'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/ui/components/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'
import { useIsMobile } from '@repo/ui/hooks/use-mobile'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { dateToYmd, nowInTz, ymdToLocalDate } from '@/src/lib/timezone'
import { cn } from '@/src/lib/utils'
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'

/** Заголовок секции; он же — имя фильтра на кнопке закрытой панели. */
export const PERIOD_TITLE = 'Период'

/**
 * Сколько лет назад и вперёд достаёт выпадашка года. Назад — чтобы дотянуться до
 * первых оплат школы, вперёд — потому что оплату можно завести будущим днём.
 * Пределы нужны явные: без них react-day-picker разворачивает список на век.
 */
const YEARS_BACK = 5
const YEARS_AHEAD = 1

export interface Period {
  from: string | null
  to: string | null
}

interface PeriodFilterProps {
  value: Period
  onChange: (next: Period) => void
}

/** Период пресета: обе границы всегда есть, в отличие от выбранного вручную. */
type FilledPeriod = { from: string; to: string }

const toPeriod = (from: Date, to: Date): FilledPeriod => ({
  from: dateToYmd(from),
  to: dateToYmd(to),
})

/**
 * Готовые периоды. Месяцами и годами, а не «последние 30 дней»: оплаты сводят по
 * закрытому месяцу, и скользящее окно тут ничего не отвечает.
 *
 * `get` ленивый — момент берётся при клике, а не при сборке списка; считается в
 * поясе организации, потому что «этот месяц» у школы во Владивостоке начинается
 * не тогда же, когда в Москве.
 */
function makePresets(tz: string) {
  return [
    {
      label: 'Этот месяц',
      get: () => toPeriod(startOfMonth(nowInTz(tz)), endOfMonth(nowInTz(tz))),
    },
    {
      label: 'Прошлый месяц',
      get: () => {
        const prev = subMonths(nowInTz(tz), 1)
        return toPeriod(startOfMonth(prev), endOfMonth(prev))
      },
    },
    {
      label: 'Этот год',
      get: () => toPeriod(startOfYear(nowInTz(tz)), endOfYear(nowInTz(tz))),
    },
  ]
}

/**
 * Период — секцией в панели фильтров, рядом с колоночными. Календарь прячется за
 * кнопку: в отличие от списка галочек, он не складывается по высоте и, стоя в
 * панели раскрытым, уводит остальные фильтры за нижний край.
 *
 * На мыши кнопка открывает поповер, на телефоне — вложенный ящик: панель фильтров
 * там сама ящик снизу, и поповер поверх неё пришлось бы ловить пальцем в остатке
 * экрана. Вложенность у Base UI своя: ящик внутри ящика не требует ничего, кроме
 * того, чтобы его отрисовали внутри, — стопку он сложит сам.
 *
 * Календарь свой, а не `DateRangeFilter` с «Выручки»: тот открывает два месяца
 * с колонкой пресетов, и до прошлогодней оплаты в нём добираться стрелками.
 * Здесь один месяц, а месяц и год выбираются выпадашками прямо в шапке.
 *
 * Значение — две date-only строки `YYYY-MM-DD`, как `Payment.date`. Границы
 * независимы: один клик даёт открытый интервал «с такого-то дня».
 */
export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const tz = useOrgTimezone()
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)

  const { from, to } = value

  // Календарь работает с `Date`, поэтому строки разворачиваем на входе и
  // сворачиваем обратно на выходе — в URL и на сервер уезжают только строки.
  const selected: DateRange | undefined = from
    ? { from: ymdToLocalDate(from), to: to ? ymdToLocalDate(to) : undefined }
    : undefined

  // Год берём в поясе организации: у школы во Владивостоке «сейчас» может быть
  // уже следующим годом.
  const { startMonth, endMonth } = useMemo(() => {
    const year = nowInTz(tz).getFullYear()
    return {
      startMonth: new Date(year - YEARS_BACK, 0),
      endMonth: new Date(year + YEARS_AHEAD, 11),
    }
  }, [tz])

  const presets = useMemo(() => makePresets(tz), [tz])

  // Показанный месяц — под контролем, потому что пресет обязан его подвинуть:
  // календарь остаётся открытым, и «Прошлый месяц» иначе выделял бы дни за
  // пределами видимой сетки, то есть внешне не делал бы ничего.
  const [month, setMonth] = useState(() => (from ? ymdToLocalDate(from) : nowInTz(tz)))

  const isEmpty = !from && !to

  const label = isEmpty
    ? 'Выберите период'
    : from && to
      ? // Год у левой границы опускаем, только когда его назовёт правая: у периода
        // через Новый год «1 дек. — 31 янв. 2026» читается как декабрь 2026, то есть
        // как промежуток, которого не бывает.
        `${from.slice(0, 4) === to.slice(0, 4) ? short(from) : long(from)} — ${long(to)}`
      : from
        ? `с ${long(from)}`
        : `по ${long(to!)}`

  const trigger = (
    <Button variant="outline" className="w-full justify-start gap-2">
      {/* Приглушаем подсказку: это не выбранное значение, а его отсутствие. */}
      <span className={cn('truncate', isEmpty && 'text-muted-foreground')}>{label}</span>
      <ChevronDown className="ml-auto opacity-50" />
    </Button>
  )

  const body = (
    <div className="flex">
      <div className="flex shrink-0 flex-col gap-1 border-r p-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="ghost"
            className="justify-start text-xs"
            onClick={() => {
              const next = preset.get()
              onChange(next)
              setMonth(ymdToLocalDate(next.from))
            }}
          >
            {preset.label}
          </Button>
        ))}
        {(from || to) && (
          // Снять только период: «Сбросить» в подвале панели фильтров чистит
          // заодно поиск и колоночные. `mt-auto` — чтобы кнопка села на нижний
          // край колонки, а не липла к пресетам: она не выбирает, а отменяет.
          // Без уточнения «период»: колонка узкая, а стоит она внутри периода.
          <Button
            variant="ghost"
            className="text-muted-foreground mt-auto justify-start text-xs"
            onClick={() => onChange({ from: null, to: null })}
          >
            Сбросить
          </Button>
        )}
      </div>
      <Calendar
        // Занять всё, что осталось от колонки пресетов: по умолчанию календарь
        // `w-fit` и жмётся влево, оставляя пустую полосу до края.
        className="min-w-0 flex-1"
        classNames={{ root: 'w-full' }}
        mode="range"
        selected={selected}
        onSelect={(range) =>
          onChange({
            from: range?.from ? dateToYmd(range.from) : null,
            to: range?.to ? dateToYmd(range.to) : null,
          })
        }
        month={month}
        onMonthChange={setMonth}
        // Всегда шесть недель: у месяца их бывает 4–6, и без этого сетка при
        // перелистывании меняет высоту, дёргая всё, что стоит под ней.
        fixedWeeks
        captionLayout="dropdown"
        startMonth={startMonth}
        endMonth={endMonth}
        locale={ru}
        // Дефолтный форматтер зовёт `toLocaleString('default')` — он берёт язык
        // браузера, а не приложения, и в шапке оказывалось «Aug».
        formatters={{ formatMonthDropdown: (date) => format(date, 'LLLL', { locale: ru }) }}
      />
    </div>
  )

  return (
    <div className="flex w-full flex-col">
      <div className={SECTION_TITLE}>{PERIOD_TITLE}</div>
      <div className="px-2">
        {isMobile ? (
          <Drawer open={isOpen} onOpenChange={setIsOpen} swipeDirection="down" showSwipeHandle>
            <DrawerTrigger render={trigger} />
            <DrawerContent>
              <DrawerHeader className="pb-2">
                <DrawerTitle>{PERIOD_TITLE}</DrawerTitle>
              </DrawerHeader>
              <div className="px-2">{body}</div>
              <DrawerFooter className="pt-2">
                <DrawerClose render={<Button />}>Готово</DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger render={trigger} />
            {/* Ширина — по кнопке (`--anchor-width` даёт позиционер Base UI), а не
                по содержимому: иначе поповер уже кнопки, под которой раскрылся.
                Выравниваем по её краю — панель и так слой поверх страницы. */}
            <PopoverContent className="w-(--anchor-width) gap-0 p-0" align="start">
              {body}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}

/** «1 авг.» — год опускаем: его назовёт вторая граница. */
function short(ymd: string) {
  return format(ymdToLocalDate(ymd), 'd MMM', { locale: ru })
}

/** «31 авг. 2026» — граница, по которой читается год всего периода. */
function long(ymd: string) {
  return format(ymdToLocalDate(ymd), 'd MMM yyyy', { locale: ru })
}
