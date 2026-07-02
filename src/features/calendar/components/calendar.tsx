'use client'

import { useIsMobile } from '@/src/hooks/use-mobile'
import { cn } from '@/src/lib/utils'
import { useCalendar, type UseCalendarOptions } from '../hooks/use-calendar'
import { DesktopCalendar } from './desktop/desktop-calendar'
import { LessonDetailDrawer } from './lesson-detail-drawer'
import { MobileCalendar } from './mobile/mobile-calendar'

export function Calendar({ className, ...options }: UseCalendarOptions & { className?: string }) {
  const ctrl = useCalendar(options)
  const isMobile = useIsMobile()

  return (
    <div
      className={cn(
        'bg-card text-foreground flex h-[calc(100svh-4rem)] flex-col overflow-hidden rounded-xl border',
        className,
      )}
    >
      {isMobile ? <MobileCalendar ctrl={ctrl} /> : <DesktopCalendar ctrl={ctrl} />}
      <LessonDetailDrawer ctrl={ctrl} />
    </div>
  )
}
