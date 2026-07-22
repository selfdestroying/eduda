import type { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cva } from 'class-variance-authority'
import { CircleAlert, CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface HintProps {
  text: string
  variant?: 'default' | 'destructive' | 'warning' | 'success'
  side?: TooltipPrimitive.Positioner.Props['side']
  className?: string
}

const hintVariants = cva('cursor-help', {
  variants: {
    variant: {
      default: '',
      destructive:
        'text-destructive hover:text-destructive hover:bg-destructive/20 dark:hover:bg-destructive/20',
      warning: 'text-warning hover:text-warning hover:bg-warning/20 dark:hover:bg-warning/20',
      success: 'text-success hover:text-success hover:bg-success/20 dark:hover:bg-success/20',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const iconMap = {
  default: CircleHelp,
  destructive: CircleX,
  warning: CircleAlert,
  success: CircleCheck,
} as const

function Hint({ text, variant = 'default', side, className }: HintProps) {
  const Icon = iconMap[variant]

  return (
    <Tooltip>
      <TooltipTrigger
        delay={300}
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={hintVariants({ variant, className })}
            aria-label={text}
          >
            <Icon aria-hidden />
          </Button>
        }
      />
      <TooltipContent side={side}>
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export { Hint }
