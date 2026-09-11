'use client'

import { maxBotUrl } from '@/src/lib/utils'
import { Button } from '@repo/ui/components/button'
import { ExternalLink } from 'lucide-react'
import { MaxIcon } from './messenger-icon'

/**
 * Ссылка на самого бота. Школе она нужна, чтобы проверить бота своими глазами и
 * чтобы было откуда скопировать адрес родителю; персональной метки здесь нет —
 * «этого родителя» на странице организации не существует.
 *
 * Клиентский только потому, что живёт в шапке клиентской карточки настроек:
 * состояния и эффектов здесь нет, адрес собирается из `NEXT_PUBLIC_*`, а те
 * подставляются на сборке и одинаково доступны с обеих сторон.
 *
 * Незаведённый бот ссылки не даёт вовсе: публикация бота в MAX требует
 * верифицированного юрлица, так что на стенде это нормальное состояние.
 */
export default function BotLinks() {
  const href = maxBotUrl()
  if (!href) return null

  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <MaxIcon className="size-4" />
      Бот MAX
      <ExternalLink />
    </Button>
  )
}
