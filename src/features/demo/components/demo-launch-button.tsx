'use client'

import { Play } from 'lucide-react'
import { useTransition, type CSSProperties } from 'react'
import { startDemo } from '../actions'
import type { DemoRole } from '../constants'

/**
 * Кнопка запуска интерактивного демо с лендинга. Логинит посетителя под
 * demo-владельцем и уводит на демо-поддомен; роли переключаются внутри баннером.
 */
export function DemoLaunchButton({
  role = 'owner',
  style,
  className,
  children = 'Попробовать демо',
}: {
  role?: DemoRole
  style?: CSSProperties
  className?: string
  children?: React.ReactNode
}) {
  const [pending, startTransition] = useTransition()

  const launch = () => {
    startTransition(async () => {
      const res = await startDemo({ role })
      if (res?.data?.url) window.location.href = res.data.url
    })
  }

  return (
    <button type="button" onClick={launch} disabled={pending} className={className} style={style}>
      <Play size={17} />
      {pending ? 'Запускаем…' : children}
    </button>
  )
}
