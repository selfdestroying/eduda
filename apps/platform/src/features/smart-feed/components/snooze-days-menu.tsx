'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import * as React from 'react'

export const SNOOZE_DAYS_OPTIONS = [1, 2, 7, 14] as const

export type SnoozeDaysOption = (typeof SNOOZE_DAYS_OPTIONS)[number]

function declDays(n: number): string {
  const abs = Math.abs(n)
  const m100 = abs % 100
  const m10 = abs % 10
  if (m100 >= 11 && m100 <= 14) return 'дней'
  if (m10 === 1) return 'день'
  if (m10 >= 2 && m10 <= 4) return 'дня'
  return 'дней'
}

interface SnoozeDaysMenuProps {
  trigger: React.ReactElement
  children?: React.ReactNode
  onSelect: (days: SnoozeDaysOption) => void
  align?: 'start' | 'center' | 'end'
}

export function SnoozeDaysMenu({
  trigger,
  children,
  onSelect,
  align = 'end',
}: SnoozeDaysMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-auto min-w-28">
        {SNOOZE_DAYS_OPTIONS.map((days) => (
          <DropdownMenuItem key={days} onClick={() => onSelect(days)}>
            {days} {declDays(days)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
