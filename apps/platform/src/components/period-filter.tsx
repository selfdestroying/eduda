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
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

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

/** Неделя с понедельника: у ru-локали date-fns `weekStartsOn: 1`, как и в календаре. */
const WEEK = { locale: ru }

/**
 * Готовые периоды. Календарными неделями, месяцами и годами, а не «последние 30
 * дней»: оплаты сводят по закрытому месяцу, и скользящее окно тут ничего не
 * отвечает.
 *
 * `get` ленивый — момент берётся при клике, а не при сборке списка; считается в
 * поясе организации, потому что «этот месяц» у школы во Владивостоке начинается
 * не тогда же, когда в Москве.
 */
function makePresets(tz: string) {
  return [
    {
      label: 'Эта неделя',
      get: () => toPeriod(startOfWeek(nowInTz(tz), WEEK), endOfWeek(nowInTz(tz), WEEK)),
    },
    {
      label: 'Прошлая неделя',
      get: () => {
        const prev = subWeeks(nowInTz(tz), 1)
        return toPeriod(startOfWeek(prev, WEEK), endOfWeek(prev, WEEK))
      },
    },
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
    {
      label: 'Прошлый год',
      get: () => {
        const prev = subYears(nowInTz(tz), 1)
        return toPeriod(startOfYear(prev), endOfYear(prev))
      },
    },
  ]
}

/** Подписи границы: заглушка на кнопке и заголовок ящика на телефоне. */
const BOUNDS = {
  from: { placeholder: 'с', title: 'Начало периода' },
  to: { placeholder: 'по', title: 'Конец периода' },
} as const

/**
 * Период — секцией в панели фильтров, рядом с колоночными. Границы независимы и
 * выбираются по отдельности, двумя кнопками через тире, как числовой диапазон в
 * тулбаре: «по 31 августа», без левой границы, — такой же законный отбор, а
 * календарь-диапазон первым кликом всегда ставил левую.
 *
 * Значение — две date-only строки `YYYY-MM-DD`, как `Payment.date`. Порядок
 * границ не навязываем: запрет выбрать «с» позже уже стоящего «по» упирался бы в
 * самый обычный сценарий — сдвинуть период на месяц вперёд.
 */
export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="flex w-full flex-col">
      <div className={SECTION_TITLE}>{PERIOD_TITLE}</div>
      <div className="flex items-center gap-2 px-2">
        <BoundPicker side="from" value={value} onChange={onChange} />
        <span className="text-muted-foreground/70">—</span>
        <BoundPicker side="to" value={value} onChange={onChange} />
      </div>
    </div>
  )
}

/**
 * Одна граница периода. Календарь прячется за кнопку: в отличие от списка
 * галочек, он не складывается по высоте и, стоя в панели раскрытым, уводит
 * остальные фильтры за нижний край.
 *
 * На мыши кнопка открывает поповер, на телефоне — вложенный ящик: панель фильтров
 * там сама ящик снизу, и поповер поверх неё пришлось бы ловить пальцем в остатке
 * экрана. Вложенность у Base UI своя: ящик внутри ящика не требует ничего, кроме
 * того, чтобы его отрисовали внутри, — стопку он сложит сам.
 *
 * Календарь один месяц, а не два: до прошлогодней оплаты в развороте на два
 * месяца добираться стрелками — здесь месяц и год выбираются выпадашками прямо
 * в шапке.
 *
 * Пресеты — в обеих половинах: они задают период целиком, и какую из кнопок
 * человек нажал, чтобы до них добраться, значения не имеет.
 */
function BoundPicker({ side, value, onChange }: { side: 'from' | 'to' } & PeriodFilterProps) {
  const tz = useOrgTimezone()
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)

  const current = value[side]
  const { placeholder, title } = BOUNDS[side]

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

  // Показанный месяц — под контролем: его двигает открытие панели.
  const [month, setMonth] = useState(() => monthOf(current ?? value.from ?? value.to, tz))

  const setOpen = (next: boolean) => {
    setIsOpen(next)
    // Открываем на том месяце, который человек и ждёт увидеть: своя граница,
    // иначе соседняя, иначе текущий. Без этого «по» после выбранного «с» в
    // прошлом году открывалось бы на сегодня, и до нужных дней пришлось бы листать.
    if (next) setMonth(monthOf(current ?? value.from ?? value.to, tz))
  }

  // Выбор границы завершается одним кликом, поэтому сразу закрываемся: держать
  // календарь открытым — значит ждать второго действия, которого нет.
  const commit = (next: Period) => {
    onChange(next)
    setIsOpen(false)
  }

  const trigger = (
    <Button variant="outline" aria-label={title} className="min-w-0 flex-1 justify-start">
      {/* Приглушаем подсказку: это не выбранное значение, а его отсутствие. */}
      <span className={cn('truncate', !current && 'text-muted-foreground')}>
        {current ? format(ymdToLocalDate(current), 'd MMM yyyy', { locale: ru }) : placeholder}
      </span>
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
            onClick={() => commit(preset.get())}
          >
            {preset.label}
          </Button>
        ))}
        {(value.from || value.to) && (
          // Снимает период целиком, обе границы: «Сбросить» в подвале панели
          // фильтров чистит заодно поиск и колоночные. `mt-auto` — чтобы кнопка
          // села на нижний край колонки, а не липла к пресетам: она не выбирает,
          // а отменяет. Без уточнения «период»: колонка узкая, а стоит она внутри
          // периода.
          <Button
            variant="ghost"
            className="text-muted-foreground mt-auto justify-start text-xs"
            onClick={() => commit({ from: null, to: null })}
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
        mode="single"
        selected={current ? ymdToLocalDate(current) : undefined}
        // Клик по уже выбранному дню снимает его — это и есть «убрать эту
        // границу», то есть период, открытый с одного конца.
        onSelect={(day) => commit({ ...value, [side]: day ? dateToYmd(day) : null })}
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

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setOpen} swipeDirection="down" showSwipeHandle>
        <DrawerTrigger render={trigger} />
        <DrawerContent>
          <DrawerHeader className="pb-2">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-2">{body}</div>
          <DrawerFooter className="pt-2">
            <DrawerClose render={<Button variant="outline" />}>Закрыть</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      {/* Ширину по кнопке не берём — это половина секции, и календарь остался бы
          в ней без сетки. Фиксированной хватает на колонку пресетов и месяц. */}
      <PopoverContent className="w-84 gap-0 p-0" align="start">
        {body}
      </PopoverContent>
    </Popover>
  )
}

/** Месяц, на котором открыть календарь: у границы — её собственный, иначе текущий. */
function monthOf(ymd: string | null, tz: string) {
  return ymd ? ymdToLocalDate(ymd) : nowInTz(tz)
}
