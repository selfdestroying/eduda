'use client'

import { maxBotUrl, vkBotUrl } from '@/src/lib/utils'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@repo/ui/components/item'
import { Skeleton } from '@repo/ui/components/skeleton'
import { BellRing, ExternalLink } from 'lucide-react'
import { useCabinetMessengersQuery, useDisconnectMessengerMutation } from '../queries'

/**
 * Подключение напоминаний в кабинете родителя.
 *
 * Ничего не «настраивает»: включает и выключает. Что именно приходит и когда —
 * решает школа, а родителю остаётся выбор канала и возможность отписаться.
 */
export default function NotificationsSection({ token }: { token: string }) {
  const { data, isPending, isError } = useCabinetMessengersQuery(token)
  const disconnect = useDisconnectMessengerMutation()

  if (isPending) return <Skeleton className="h-40 w-full rounded-xl" />

  // Школа выключила фичу (`null`) или раздел не загрузился — молча ничего не
  // показываем: это не то, ради чего родитель открыл кабинет.
  if (isError || !data) return null

  const vkLink = vkBotUrl(token)
  const maxLink = maxBotUrl()

  // Ни один бот не заведён — показывать нечего.
  if (!vkLink && !maxLink) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BellRing className="text-muted-foreground size-4" />
        <h2 className="text-lg font-semibold tracking-tight">Напоминания о занятиях</h2>
      </div>

      <ItemGroup className="gap-2">
        {vkLink && (
          <Channel
            name="ВКонтакте"
            connected={data.vk}
            href={vkLink}
            hint="Откроется чат с ботом. Нажмите «Начать» — этого достаточно, ссылка уже персональная."
            onDisconnect={() => disconnect.mutate({ token, provider: 'VK' })}
            disabled={disconnect.isPending}
          />
        )}

        {maxLink && (
          <Channel
            name="MAX"
            connected={data.max}
            href={data.hasPhone ? maxLink : null}
            hint={
              data.hasPhone
                ? 'Откроется чат с ботом. Нажмите «Отправить номер» — по нему я найду вашего ребёнка.'
                : 'В школе не записан ваш номер телефона — без него подключить MAX не получится. Укажите его выше или попросите администратора.'
            }
            onDisconnect={() => disconnect.mutate({ token, provider: 'MAX' })}
            disabled={disconnect.isPending}
          />
        )}
      </ItemGroup>
    </div>
  )
}

function Channel({
  name,
  connected,
  href,
  hint,
  onDisconnect,
  disabled,
}: {
  name: string
  connected: boolean
  href: string | null
  hint: string
  onDisconnect: () => void
  disabled: boolean
}) {
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle className="flex items-center gap-2">
          {name}
          {connected && <Badge variant="secondary">Подключено</Badge>}
        </ItemTitle>
        <ItemDescription>{hint}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {connected ? (
          <Button variant="outline" onClick={onDisconnect} disabled={disabled}>
            Отключить
          </Button>
        ) : (
          href && (
            <Button
              nativeButton={false}
              render={<a href={href} target="_blank" rel="noopener noreferrer" />}
            >
              Подключить
              <ExternalLink />
            </Button>
          )
        )}
      </ItemActions>
    </Item>
  )
}
