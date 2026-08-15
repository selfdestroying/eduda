'use client'

import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'

import { cn } from '@repo/ui/lib/utils'

/**
 * Прокрутка со скроллбаром поверх содержимого: нативный спрятан, свой лежит
 * абсолютом и ширину контейнера не отъедает. Появляется на прокрутке и при
 * наведении, дальше гаснет — `data-scrolling`/`data-hovering` считает сам Base UI.
 *
 * Нативной альтернативы этому нет: overlay-скроллбары есть только в macOS/iOS,
 * а `overflow: overlay` из WebKit выпилен.
 */
function ScrollArea({ className, children, ...props }: ScrollAreaPrimitive.Root.Props) {
  return (
    // Колонка флексом, а не `size-full` у вьюпорта: высота корня приходит от
    // `flex-1` родителя, то есть свойство `height` у него `auto`, и процент
    // внутри резолвится в `auto` — вьюпорт вырастал по содержимому и уезжал под
    // футер drawer'а вместо прокрутки.
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative flex flex-col', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/30 min-h-0 w-full flex-1 overscroll-contain rounded-[inherit] outline-none focus-visible:ring-[2px]"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-px opacity-0 transition-opacity duration-200 select-none data-hovering:opacity-100 data-horizontal:h-1.5 data-horizontal:flex-col data-scrolling:opacity-100 data-vertical:h-full data-vertical:w-1.5',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="bg-foreground/25 relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
