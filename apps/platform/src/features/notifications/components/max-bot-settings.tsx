'use client'

import { useSessionQuery } from '@/src/features/users/me/queries'
import { maxBotUrl, parentCabinetUrl } from '@/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@repo/ui/components/alert-dialog'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@repo/ui/components/field'
import { PasswordInput } from '@repo/ui/components/password-input'
import { Skeleton } from '@repo/ui/components/skeleton'
import { ExternalLink, Loader } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useConnectMaxBotMutation, useDisconnectMaxBotMutation, useMaxBotQuery } from '../queries'
import { MaxBotTokenSchema, type MaxBotTokenSchemaType } from '../schemas'
import { MaxIcon } from './messenger-icon'

/**
 * Каким ботом школа рассылает напоминания: ботом ЕДУДА или своим.
 *
 * Подключает и отключает только владелец: токен даёт полное управление ботом
 * школы. Управляющий видит, какой бот сейчас работает, но формы у него нет. Это
 * гейт видимости, а не доступа — роль проверяет экшен.
 *
 * Ссылка на бота живёт здесь, а не в шапке настроек рассылки: какой бот, такая
 * и ссылка.
 */
export default function MaxBotSettings() {
  const { data: session } = useSessionQuery()
  const { data: bot, isPending, isError } = useMaxBotQuery()

  if (isPending) return <Skeleton className="h-40 w-full rounded-xl" />
  if (isError) {
    return (
      <p className="text-muted-foreground text-sm">
        Не удалось загрузить бота школы. Обновите страницу.
      </p>
    )
  }

  const href = maxBotUrl(bot?.username)
  const isOwner = session?.memberRole === 'owner'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Бот MAX</CardTitle>
        <CardDescription>
          {bot
            ? 'Напоминания приходят родителям от бота школы.'
            : 'Напоминания приходят от бота ЕДУДА. Можно подключить бота своей школы — тогда родители увидят в чате его имя и аватарку.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <MaxIcon />
          <span className="text-sm font-medium">{bot ? `@${bot.username}` : 'Бот ЕДУДА'}</span>
          <Badge variant="secondary">{bot ? 'Свой бот' : 'По умолчанию'}</Badge>
          {href && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={href} target="_blank" rel="noopener noreferrer" />}
            >
              Открыть чат
              <ExternalLink />
            </Button>
          )}
        </div>

        {isOwner && (bot ? <DisconnectBot username={bot.username} /> : <ConnectBot />)}
      </CardContent>
    </Card>
  )
}

/**
 * Подключение своего бота. Шаги у школы перед формой, а не в документации:
 * пропущенный адрес мини-приложения ничего не ломает при подключении, а
 * обнаруживается только тогда, когда родитель не может открыть кабинет из чата.
 */
function ConnectBot() {
  const mutation = useConnectMaxBotMutation()
  const form = useForm<MaxBotTokenSchemaType>({
    resolver: zodResolver(MaxBotTokenSchema),
    defaultValues: { token: '' },
  })

  const submit = form.handleSubmit((values) =>
    mutation.mutate(values, { onSuccess: () => form.reset() }),
  )

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
        <li>
          Создайте бота на платформе MAX для партнёров — от имени организации, ИП или самозанятого.
        </li>
        <li>
          В настройках бота укажите адрес мини-приложения:{' '}
          <span className="text-foreground font-mono break-all">{parentCabinetUrl('max')}</span>
        </li>
        <li>Бот должен работать только с ЕДУДА — не подключайте его к CRM и другим сервисам.</li>
        <li>Скопируйте токен бота и вставьте его ниже.</li>
      </ol>

      <Controller
        control={form.control}
        name="token"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor="max-bot-token">Токен бота</FieldLabel>
            <PasswordInput id="max-bot-token" autoComplete="off" {...field} />
            <FieldDescription>
              После подключения токен не показывается никому. Родителям нужно будет заново нажать
              «Отправить номер» — уже в чате с ботом школы: до этого напоминания им не приходят.
            </FieldDescription>
            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
          </Field>
        )}
      />

      <div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader className="animate-spin" />}
          Подключить бота
        </Button>
      </div>
    </form>
  )
}

function DisconnectBot({ username }: { username: string }) {
  const mutation = useDisconnectMaxBotMutation()

  return (
    <div>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="outline">Вернуться на бота ЕДУДА</Button>} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить @{username}?</AlertDialogTitle>
            <AlertDialogDescription>
              Напоминания пойдут через бота ЕДУДА. Родители, которые подключались только к боту
              школы, перестанут их получать, пока не подключатся к боту ЕДУДА. Если позже подключить
              этого же бота снова, прежние подключения родителей заработают.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              Отключить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
