import * as React from 'react'

import { cn } from '@/src/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const progressVariants = cva('h-1.5 rounded-full transition-all duration-500 ease-out', {
  variants: {
    variant: {
      default: 'bg-primary',
      success: 'bg-emerald-500 dark:bg-emerald-400',
      warning: 'bg-amber-500 dark:bg-amber-400',
      danger: 'bg-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

interface ProgressProps extends React.ComponentProps<'div'>, VariantProps<typeof progressVariants> {
  value: number
  max?: number
}

function Progress({ value, max = 100, variant, className, ...props }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      className={cn('bg-muted relative h-1.5 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div className={cn(progressVariants({ variant }))} style={{ width: `${percentage}%` }} />
    </div>
  )
}

export { Progress, progressVariants }
