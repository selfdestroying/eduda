'use client'

import { Checkbox } from '@repo/ui/components/checkbox'
import { cn } from '@/src/lib/utils'
import { FILTER_DIMENSION_TITLES, type EventFiltersController } from '../hooks/use-event-filters'
import type { CalendarCategory, FilterDimension } from '../types'
import { withAlpha } from '../lib/date-utils'

const rowBase =
  'hover:bg-muted flex items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors'
const countBadge =
  'text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs font-medium tabular-nums'

/** Одна секция фильтра (Типы групп / Курсы / Локации / Преподаватели) с чекбоксами. */
function FilterSection({
  title,
  dimension,
  categories,
  ctrl,
}: {
  title: string
  dimension: FilterDimension
  categories: CalendarCategory[]
  ctrl: EventFiltersController
}) {
  return (
    <div className="flex flex-col">
      {categories.length > 0 ? (
        // Мастер-чекбокс «все» — тот же паттерн строки, что и категории ниже.
        <label className="mb-2 flex cursor-pointer items-center gap-2.5 px-2">
          <Checkbox
            checked={ctrl.allCategoriesActive(dimension)}
            onCheckedChange={() => ctrl.toggleAllCategories(dimension)}
            aria-label={`Включить/выключить все: ${title}`}
          />
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {title}
          </span>
        </label>
      ) : (
        <div className="text-muted-foreground mb-2 px-2 text-xs font-semibold tracking-wide uppercase">
          {title}
        </div>
      )}
      {categories.length === 0 ? (
        <div className="text-muted-foreground/70 px-2 text-xs">Нет уроков</div>
      ) : (
        categories.map((cat) => {
          const active = ctrl.isCategoryActive(dimension, cat.id)
          const toggle = () => ctrl.toggleCategory(dimension, cat.id)

          // Единый паттерн: Checkbox внутри <label> — клик по всей строке переключает
          // его через скрытый <input>, имя берётся из текста метки. У типов групп
          // отмеченный чекбокс окрашен в цвет типа (= цвет события на календаре) как легенда.
          const checkboxStyle =
            dimension === 'groupType' && active
              ? { backgroundColor: withAlpha(cat.color, 1), borderColor: withAlpha(cat.color, 1) }
              : undefined
          return (
            <label key={cat.id} className={cn(rowBase, 'cursor-pointer py-1.5')}>
              <Checkbox checked={active} onCheckedChange={toggle} style={checkboxStyle} />
              <span className="flex-1 truncate">{cat.name}</span>
              <span className={countBadge}>{cat.count}</span>
            </label>
          )
        })
      )}
    </div>
  )
}

/**
 * Секции фильтров (типы групп / курсы / локации / преподаватели).
 * Переиспользуется десктоп-панелью календаря, мобильным drawer'ом и панелью
 * управления — набор секций задаёт контроллер (`ctrl.dimensions`).
 */
export function CalendarFilters({
  ctrl,
  className,
}: {
  ctrl: EventFiltersController
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {ctrl.dimensions.map((dimension) => (
        <FilterSection
          key={dimension}
          title={FILTER_DIMENSION_TITLES[dimension]}
          dimension={dimension}
          categories={ctrl.categoriesByDim[dimension]}
          ctrl={ctrl}
        />
      ))}
    </div>
  )
}
