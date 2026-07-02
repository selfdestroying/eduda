'use client'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { enableCalendarHomeView } from '@/src/features/calendar/lib/view-preference'
import { ArrowUpRight, CalendarDays, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'dashboard-calendar-promo-dismissed'

/**
 * Промо-баннер миграции на новый календарь (этап 1).
 * Закрытие запоминается в localStorage; до маунта не рендерится,
 * чтобы не расходиться с серверной разметкой.
 */
export function CalendarPromoBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(localStorage.getItem(DISMISS_KEY) === null)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-50">
      <CalendarDays aria-hidden />
      <AlertTitle>Попробуйте новый календарь.</AlertTitle>
      <AlertDescription className="[&_a]:text-blue-900 [&_a]:no-underline [&_a]:dark:text-blue-50 [&_p:not(:last-child)]:mb-2">
        <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-center">
          Расписание на день, неделю и месяц, фильтры по локациям и преподавателям.
          <Button
            variant={'outline'}
            nativeButton={false}
            render={<Link href={'/calendar'} onClick={enableCalendarHomeView} />}
          >
            Включить новый вид
            <ArrowUpRight />
          </Button>
        </div>
      </AlertDescription>
      <AlertAction>
        <Button variant="ghost" onClick={dismiss}>
          <X />
        </Button>
      </AlertAction>
    </Alert>
  )
}
