'use client'

import { maxBotUrl, vkBotUrl } from '@/src/lib/utils'
import { Button } from '@repo/ui/components/button'
import { ExternalLink } from 'lucide-react'
import { MESSENGER_NAME, MessengerIcon } from './messenger-icon'

/**
 * Ссылки на самих ботов. Школе они нужны, чтобы проверить бота своими глазами и
 * чтобы было откуда скопировать адрес родителю; персональной метки здесь нет —
 * «этого родителя» на странице организации не существует.
 *
 * Клиентский только потому, что живёт в шапке клиентской карточки настроек:
 * состояния и эффектов здесь нет, адреса собираются из `NEXT_PUBLIC_*`, а те
 * подставляются на сборке и одинаково доступны с обеих сторон.
 *
 * Незаведённый бот ссылки не даёт вовсе — у MAX это нормальное состояние,
 * публикация там требует верифицированного юрлица.
 */
export default function BotLinks() {
  const links = [
    { provider: 'VK', href: vkBotUrl() },
    { provider: 'MAX', href: maxBotUrl() },
  ] as const

  const available = links.filter((link) => link.href)
  if (available.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {available.map(({ provider, href }) => (
        <Button
          key={provider}
          variant="outline"
          nativeButton={false}
          render={<a href={href!} target="_blank" rel="noopener noreferrer" />}
        >
          <MessengerIcon provider={provider} className="size-4" hideLabel />
          Бот {MESSENGER_NAME[provider]}
          <ExternalLink />
        </Button>
      ))}
    </div>
  )
}
