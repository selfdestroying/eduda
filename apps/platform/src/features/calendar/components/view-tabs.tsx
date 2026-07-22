'use client'

import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { cn } from '@/src/lib/utils'
import type { CalendarView } from '../types'

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
  { value: 'list', label: 'Список' },
]

export function ViewTabs({
  view,
  onChange,
  fullWidth,
}: {
  view: CalendarView
  onChange: (v: CalendarView) => void
  fullWidth?: boolean
}) {
  return (
    <Tabs value={view} onValueChange={(v) => onChange(v as CalendarView)}>
      <TabsList className={cn('h-9', fullWidth && 'w-full')}>
        {VIEWS.map((v) => (
          <TabsTrigger key={v.value} value={v.value} className="px-3 text-[12.5px]">
            {v.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
