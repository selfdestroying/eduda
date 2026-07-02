'use client'

import { Button } from '@/src/components/ui/button'
import { Undo2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { disableCalendarHomeView, isCalendarHomeView } from '../lib/view-preference'

/**
 * Возврат к классической панели управления: снимает куку выбора и уводит на `/`.
 * Показывается только когда новый вид включён; до маунта не рендерится,
 * чтобы не расходиться с серверной разметкой.
 */
export function ClassicViewButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(isCalendarHomeView())
  }, [])

  if (!visible) return null

  const revert = () => {
    disableCalendarHomeView()
    router.push('/')
  }

  if (iconOnly) {
    return (
      <Button variant="outline" size="icon" onClick={revert} aria-label="Вернуть старый вид">
        <Undo2 />
      </Button>
    )
  }

  return (
    <Button variant="outline" onClick={revert}>
      <Undo2 />
      Старый вид
    </Button>
  )
}
