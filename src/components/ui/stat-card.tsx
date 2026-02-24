import * as React from 'react'

import { cn } from '@/src/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { LucideIcon } from 'lucide-react'

const statCardVariants = cva('relative overflow-hidden rounded-lg p-3 transition-colors', {
  variants: {
    variant: {
      default: 'bg-muted/50',
      success: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      warning: 'bg-amber-50/50 dark:bg-amber-950/20',
      danger: 'bg-red-50/50 dark:bg-red-950/20',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const statIconVariants = cva('size-4 shrink-0', {
  variants: {
    variant: {
      default: 'text-muted-foreground',
      success: 'text-emerald-600 dark:text-emerald-400',
      warning: 'text-amber-600 dark:text-amber-400',
      danger: 'text-red-600 dark:text-red-400',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

interface StatCardProps extends React.ComponentProps<'div'>, VariantProps<typeof statCardVariants> {
  label: string
  value: React.ReactNode
  description?: string
  icon?: LucideIcon
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  variant,
  className,
  ...props
}: StatCardProps) {
  return (
    <div className={cn(statCardVariants({ variant }), className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        {Icon && <Icon className={cn(statIconVariants({ variant }))} />}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{value}</div>
      {description && (
        <p className="text-muted-foreground mt-0.5 text-[0.6875rem] leading-tight">{description}</p>
      )}
    </div>
  )
}

export { StatCard, statCardVariants }
