'use client'

import { Button } from '@/src/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/src/components/ui/drawer'
import { useIsMobile } from '@/src/hooks/use-mobile'
import { Filter } from 'lucide-react'
import type { CalendarController } from '../hooks/use-calendar'
import { CalendarFilters } from './calendar-filters'

/**
 * Кнопка-триггер + drawer с фильтрами календаря для компактных раскладок
 * (мобильные и планшеты 768–1024px, где боковая панель скрыта).
 * На мобильных выезжает снизу, на планшете — справа.
 */
export function FiltersDrawer({ ctrl }: { ctrl: CalendarController }) {
  const isMobile = useIsMobile()

  return (
    <Drawer direction={isMobile ? 'bottom' : 'right'}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="relative flex-none" aria-label="Фильтры">
          <Filter />
          {ctrl.hasActiveFilters && (
            <span className="bg-primary border-card absolute -top-1 -right-1 size-2.5 rounded-full border-2" />
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Фильтры</DrawerTitle>
          <DrawerDescription>Курсы, локации и преподаватели</DrawerDescription>
        </DrawerHeader>
        <CalendarFilters
          ctrl={ctrl}
          className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-2"
        />
        <DrawerFooter>
          <DrawerClose asChild>
            <Button>Готово</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
