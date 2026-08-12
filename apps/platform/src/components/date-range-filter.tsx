'use client'

import { Button } from '@repo/ui/components/button'
import { Calendar } from '@repo/ui/components/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { nowInTz } from '@/src/lib/timezone'
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'

// getValue ленивый — момент берётся при клике, а не при сборке списка.
function makePresets(tz: string) {
  return [
    {
      label: 'Текущая неделя',
      getValue: () => ({
        from: startOfWeek(nowInTz(tz), { weekStartsOn: 1 }),
        to: endOfWeek(nowInTz(tz), { weekStartsOn: 1 }),
      }),
    },
    {
      label: 'Прошлая неделя',
      getValue: () => ({
        from: startOfWeek(subWeeks(nowInTz(tz), 1), { weekStartsOn: 1 }),
        to: endOfWeek(subWeeks(nowInTz(tz), 1), { weekStartsOn: 1 }),
      }),
    },
    {
      label: 'Текущий месяц',
      getValue: () => ({ from: startOfMonth(nowInTz(tz)), to: endOfMonth(nowInTz(tz)) }),
    },
    {
      label: 'Прошлый месяц',
      getValue: () => ({
        from: startOfMonth(subMonths(nowInTz(tz), 1)),
        to: endOfMonth(subMonths(nowInTz(tz), 1)),
      }),
    },
  ]
}

interface DateRangeFilterProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  /** Текст на кнопке, когда период не выбран. */
  placeholder?: string
  /** Показывать крестик сброса рядом с кнопкой. */
  clearable?: boolean
}

/**
 * Выбор периода: пресеты слева, двухмесячный календарь справа.
 * Пресеты считаются в поясе организации — «текущий месяц» у школы во
 * Владивостоке начинается не тогда же, когда в Москве.
 */
export default function DateRangeFilter({
  value,
  onChange,
  placeholder = 'Выберите период',
  clearable = true,
}: DateRangeFilterProps) {
  const tz = useOrgTimezone()
  const presets = useMemo(() => makePresets(tz), [tz])
  const [isOpen, setIsOpen] = useState(false)

  const label = !value?.from
    ? placeholder
    : !value.to
      ? format(value.from, 'd MMM yyyy', { locale: ru })
      : `${format(value.from, 'd MMM', { locale: ru })} — ${format(value.to, 'd MMM yyyy', { locale: ru })}`

  return (
    <div className="flex items-center gap-1">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" className="min-w-50 justify-start gap-2">
              <CalendarIcon />
              <span className="truncate">{label}</span>
              <ChevronDown className="ml-auto opacity-50" />
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="border-r p-2">
              <div className="text-muted-foreground mb-2 px-2 text-xs font-medium">
                Быстрый выбор
              </div>
              <div className="flex flex-col gap-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    className="justify-start text-xs"
                    onClick={() => {
                      onChange(preset.getValue())
                      setIsOpen(false)
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <Calendar
              mode="range"
              defaultMonth={value?.from}
              selected={value}
              onSelect={onChange}
              locale={ru}
              numberOfMonths={2}
            />
          </div>
        </PopoverContent>
      </Popover>

      {clearable && value && (
        <Button variant="ghost" size="icon" onClick={() => onChange(undefined)}>
          <span className="sr-only">Сбросить период</span>
          <X />
        </Button>
      )}
    </div>
  )
}
