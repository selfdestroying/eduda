'use client'

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@repo/ui/components/empty'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@repo/ui/components/item'
import { Loader } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'
import { useCallback, useState } from 'react'

/**
 * Вход в кабинет из мини-приложения MAX.
 *
 * Адрес этой страницы — `parent.{домен}/max`, он прописан у бота в
 * бизнес-панели MAX. Мессенджер открывает её во встроенном браузере, дописав
 * данные запуска во фрагмент URL. Фрагмент до сервера не доезжает, поэтому
 * строку читает клиент (`WebApp` появляется вместе со скриптом MAX) и
 * отправляет на проверку подписи; сервер отвечает кабинетами этого аккаунта, и
 * дальше работает обычный кабинет — он живёт на токене в ссылке, без кук и без
 * входа.
 *
 * Страница лежит на поддомене кабинета, а не на корневом домене, чтобы переход
 * после входа остался внутри одного origin.
 *
 * Своей вёрстки кабинета здесь нет: страница показывает ровно то, что не может
 * закончиться редиректом.
 */

type Cabinet = { token: string; parent: string; organization: string }

type State =
  | { kind: 'loading' }
  /** Открыли не из MAX: скрипт загрузился, но данных запуска нет. */
  | { kind: 'outside' }
  /** Подпись сошлась, но за этим MAX-аккаунтом не числится ни одного родителя. */
  | { kind: 'unbound' }
  | { kind: 'choice'; cabinets: Cabinet[] }
  | { kind: 'error'; reason: string }

export default function MaxEntryPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  const enter = useCallback(async () => {
    const initData = (window as { WebApp?: { initData?: string } }).WebApp?.initData
    if (!initData) {
      setState({ kind: 'outside' })
      return
    }

    try {
      const response = await fetch('/api/max/enter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const body = (await response.json()) as { cabinets?: Cabinet[]; error?: string }

      if (!response.ok) {
        setState({ kind: 'error', reason: body.error ?? `ошибка ${response.status}` })
        return
      }

      const cabinets = body.cabinets ?? []
      if (cabinets.length === 0) {
        setState({ kind: 'unbound' })
        return
      }
      // Один кабинет — сразу в него, и не через роутер: `replace` из истории
      // убирает эту страницу, иначе кнопка «назад» в MAX возвращала бы на
      // экран загрузки, который тут же снова уводит в кабинет.
      if (cabinets.length === 1) {
        window.location.replace(`/${cabinets[0]!.token}`)
        return
      }

      setState({ kind: 'choice', cabinets })
    } catch (error) {
      console.error('max: вход в кабинет не удался', error)
      setState({ kind: 'error', reason: 'не удалось связаться с сервером' })
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-8">
      {/* `onReady` срабатывает и когда скрипт уже загружен, поэтому отдельной
          проверки «а вдруг успел раньше» не нужно. */}
      <Script
        src="https://st.max.ru/js/max-web-app.js"
        onReady={() => void enter()}
        onError={() => setState({ kind: 'outside' })}
      />
      <Screen state={state} />
    </main>
  )
}

function Screen({ state }: { state: State }) {
  switch (state.kind) {
    case 'loading':
      return (
        <Empty>
          <EmptyHeader>
            <Loader className="text-primary size-5 animate-spin" />
            <EmptyTitle>Открываем кабинет</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )

    case 'outside':
      return (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Кабинет открывается из MAX</EmptyTitle>
            <EmptyDescription>
              Эта страница работает внутри мессенджера. Откройте её кнопкой в чате с ботом школы.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )

    case 'unbound':
      return (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Мы вас не узнали</EmptyTitle>
            <EmptyDescription>
              Вернитесь в чат с ботом и нажмите «Отправить номер» — по номеру телефона мы найдём
              ваших детей и откроем кабинет.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )

    case 'choice':
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-medium">Выберите школу</h1>
            <p className="text-muted-foreground text-sm">
              Ваши дети занимаются в нескольких школах — у каждой свой кабинет.
            </p>
          </div>
          <ItemGroup className="gap-2">
            {state.cabinets.map((cabinet) => (
              <Item
                key={cabinet.token}
                variant="outline"
                render={<Link href={`/${cabinet.token}`} replace />}
              >
                <ItemContent>
                  <ItemTitle>{cabinet.organization}</ItemTitle>
                  <ItemDescription>{cabinet.parent}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </div>
      )

    case 'error':
      return (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Не удалось открыть кабинет</EmptyTitle>
            {/* Причину показываем как есть: разбираться с ней будет школа, а не
                родитель, и «что-то пошло не так» ей ничего не скажет. */}
            <EmptyDescription>{state.reason}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
  }
}
