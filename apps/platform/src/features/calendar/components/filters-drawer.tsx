'use client'

import { Button } from '@repo/ui/components/button'
import { ButtonGroup } from '@repo/ui/components/button-group'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/ui/components/drawer'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import { Separator } from '@repo/ui/components/separator'
import { useIsMobile } from '@repo/ui/hooks/use-mobile'
import { cn } from '@/src/lib/utils'
import { ListFilter, X } from 'lucide-react'
import type { EventFiltersController } from '../hooks/use-event-filters'
import { CalendarFilters } from './calendar-filters'

/**
 * Сколько названий фильтров помещается на кнопке до «+N» — как в тулбаре таблиц.
 */
const VISIBLE_FILTER_TITLES = 2

/**
 * Кнопка-триггер + drawer с фильтрами: и календарь, и панель управления.
 * Форма — тулбара таблиц (`DataTableToolbar`): воронка с именами включённых
 * фильтров и сброс рядом. Панель закрыта, и счётчик не сказал бы, по чему
 * отобрано. На мобильных выезжает снизу, на остальных — справа.
 */
export function FiltersDrawer({
  ctrl,
  /**
   * Только воронка, без подписи и имён включённых фильтров. Для шапок календаря:
   * там кнопка стоит в одном ряду с навигацией и переключателем вида, и полная
   * форма уводит ряд в перенос на планшете.
   */
  compact = false,
}: {
  ctrl: EventFiltersController
  compact?: boolean
}) {
  const isMobile = useIsMobile()
  const { activeTitles } = ctrl

  return (
    <ButtonGroup>
      <Drawer swipeDirection={isMobile ? 'down' : 'right'} showSwipeHandle={isMobile}>
        <DrawerTrigger
          render={
            <Button
              variant="outline"
              size={compact ? 'icon' : undefined}
              aria-label="Фильтры"
              className={cn('shrink-0', compact && 'relative')}
            />
          }
        >
          <ListFilter />
          {/* В компактной форме имён нет — о включённом фильтре говорит точка. */}
          {compact && ctrl.hasActiveFilters && (
            <span className="bg-primary border-card absolute -top-1 -right-1 size-2.5 rounded-full border-2" />
          )}
          {/* На телефоне остаётся одна иконка: подпись съедает ширину, которой
              в ряду и так нет, а иконка воронки читается без слов. */}
          {!compact && <span className="max-sm:hidden">Фильтры</span>}
          {activeTitles.length > 0 && !compact && (
            <>
              <Separator orientation="vertical" className="mx-0.5" />
              <span className="text-muted-foreground max-w-48 truncate max-sm:hidden">
                {activeTitles.slice(0, VISIBLE_FILTER_TITLES).join(', ')}
                {activeTitles.length > VISIBLE_FILTER_TITLES &&
                  ` +${activeTitles.length - VISIBLE_FILTER_TITLES}`}
              </span>
              <span className="text-muted-foreground tabular-nums sm:hidden">
                {activeTitles.length}
              </span>
            </>
          )}
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="pb-4">
            <DrawerTitle>Фильтры</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="min-h-0 flex-1">
            <CalendarFilters ctrl={ctrl} className="px-4" />
          </ScrollArea>
          <DrawerFooter className="pt-4">
            <Button variant="outline" onClick={ctrl.reset} disabled={!ctrl.hasActiveFilters}>
              <X />
              Сбросить
            </Button>
            <DrawerClose render={<Button />}>Готово</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Сброс под рукой, не открывая панель, — но только когда отобрано. */}
      {ctrl.hasActiveFilters && !compact && (
        <Button
          variant="outline"
          size="icon"
          onClick={ctrl.reset}
          aria-label="Сбросить фильтры"
          className="shrink-0"
        >
          <X />
        </Button>
      )}
    </ButtonGroup>
  )
}
