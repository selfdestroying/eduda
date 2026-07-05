'use client'

import { Checkbox } from '@/src/components/ui/checkbox'
import { cn } from '@/src/lib/utils'
import type { CalendarController } from '../hooks/use-calendar'
import type { CalendarCategory, FilterDimension } from '../types'
import { hexA } from '../lib/date-utils'

const rowBase =
  'hover:bg-muted flex items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors'
const countBadge =
  'text-muted-foreground bg-muted rounded-[5px] px-1.5 py-px text-[11px] font-medium tabular-nums'

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
  ctrl: CalendarController
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
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            {title}
          </span>
        </label>
      ) : (
        <div className="text-muted-foreground mb-2 px-2 text-[11px] font-semibold tracking-wide uppercase">
          {title}
        </div>
      )}
      {categories.length === 0 ? (
        <div className="text-muted-foreground/70 px-2 text-[12.5px]">Нет уроков</div>
      ) : (
        categories.map((cat) => {
          const active = ctrl.isCategoryActive(dimension, cat.id)
          const toggle = () => ctrl.toggleCategory(dimension, cat.id)
          const tone = active ? 'text-foreground' : 'text-muted-foreground/70'

          // Единый паттерн: Checkbox внутри <label> — клик по всей строке переключает
          // его через скрытый <input>, имя берётся из текста метки. У типов групп
          // отмеченный чекбокс окрашен в цвет типа (= цвет события на календаре) как легенда.
          const checkboxStyle =
            dimension === 'groupType' && active
              ? { backgroundColor: hexA(cat.color, 1), borderColor: hexA(cat.color, 1) }
              : undefined
          return (
            <label key={cat.id} className={cn(rowBase, 'cursor-pointer py-1.5', tone)}>
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
 * Секции фильтров календаря (типы групп / курсы / локации / преподаватели).
 * Переиспользуется в десктоп-боковой панели и в мобильном drawer.
 */
export function CalendarFilters({
  ctrl,
  className,
}: {
  ctrl: CalendarController
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <FilterSection
        title="Тип группы"
        dimension="groupType"
        categories={ctrl.groupTypeCategories}
        ctrl={ctrl}
      />
      <FilterSection
        title="Курсы"
        dimension="course"
        categories={ctrl.courseCategories}
        ctrl={ctrl}
      />
      <FilterSection
        title="Локации"
        dimension="location"
        categories={ctrl.locationCategories}
        ctrl={ctrl}
      />
      <FilterSection
        title="Преподаватели"
        dimension="teacher"
        categories={ctrl.teacherCategories}
        ctrl={ctrl}
      />
    </div>
  )
}
