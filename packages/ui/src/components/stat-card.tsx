import * as React from 'react'

import { Hint } from '@repo/ui/components/hint'
import { cn } from '@repo/ui/lib/utils'
import { LucideIcon } from 'lucide-react'

/*
 * Карточка нейтральная. Раньше у неё был проп `variant` с четырьмя значениями,
 * который красил подложку и иконку в интенты, — цвет убран целиком, а вместе с
 * ним и сам проп: вариант, который ничего не меняет, хуже отсутствующего.
 *
 * Значение выделяется размером и насыщенностью шрифта, а не цветом фона.
 * Понадобится сигнал обратно — это `className` на конкретном месте вызова,
 * а не оживление варианта на все 59 карточек.
 */
interface StatCardProps extends React.ComponentProps<'div'> {
  label: string
  value: React.ReactNode
  description?: string
  icon?: LucideIcon
  hint?: string
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  hint,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-muted/50 relative overflow-hidden rounded-lg p-3 transition-colors',
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-0.5 text-xs font-medium">
          {label}
          {hint && <Hint text={hint} />}
        </span>
        {Icon && <Icon className="text-muted-foreground size-4 shrink-0" />}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{value}</div>
      {description && (
        <p className="text-muted-foreground mt-0.5 text-xs leading-tight">{description}</p>
      )}
    </div>
  )
}

export { StatCard }
