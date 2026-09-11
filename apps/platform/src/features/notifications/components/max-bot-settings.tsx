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
} from '@repo/ui/components/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@repo/ui/components/field'
import { Logo } from '@repo/ui/components/logo'
import { PasswordInput } from '@repo/ui/components/password-input'
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/radio-group'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Check, ExternalLink, Loader } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type { MaxBotProfile } from '../bot.server'
import {
  useConnectMaxBotMutation,
  useMaxBotQuery,
  useSetMaxBotEnabledMutation,
  useTestMaxBotMutation,
} from '../queries'
import { MaxBotTokenSchema, type MaxBotTokenSchemaType } from '../schemas'

/**
 * Каким ботом школа рассылает напоминания: ботом ЕДУДА или своим.
 *
 * Выбор — радио-карточками, как «Когда отправлять» в соседней карточке: это
 * настройка, а не переключение вида. Выбранная карточка — то, что выбрала школа,
 * бейдж «Работает» — какой бот пишет родителям на самом деле. Они расходятся
 * ровно в одном случае: выбран «Свой бот», а бот ещё не сохранён — тогда пишет
 * по-прежнему ЕДУДА, а у своего бейдж «Не сохранён».
 *
 * Сохранённый бот переключается по-настоящему и только после подтверждения:
 * переключение сразу меняет, кому из родителей приходят напоминания. Возврат на
 * ЕДУДА бота не удаляет, а выключает — токен вводить заново не придётся.
 *
 * Выбирает и подключает только владелец: токен даёт полное управление ботом
 * школы. Управляющий видит выбор, но не меняет его. Это гейт видимости, а не
 * доступа — роль проверяет экшен.
 */

type Choice = 'default' | 'own'

const initialOf = (bot: { name: string | null; username: string }) =>
  (bot.name ?? bot.username).slice(0, 1).toUpperCase()

export default function MaxBotSettings() {
  const { data: session } = useSessionQuery()
  const { data: bot, isPending, isError } = useMaxBotQuery()
  const setEnabled = useSetMaxBotEnabledMutation()

  // Выбран «Свой бот», а сохранённого бота нет: это намерение, а не настройка —
  // в базе ничего не меняется, пока токен не сохранят.
  const [pendingOwn, setPendingOwn] = useState(false)
  // Переключение сохранённого бота, ждущее подтверждения.
  const [confirm, setConfirm] = useState<Choice | null>(null)

  if (isPending) return <Skeleton className="h-48 w-full rounded-xl" />
  if (isError) {
    return (
      <p className="text-muted-foreground text-sm">
        Не удалось загрузить бота школы. Обновите страницу.
      </p>
    )
  }

  const isOwner = session?.memberRole === 'owner'
  const working: Choice = bot?.enabled ? 'own' : 'default'
  const selected: Choice = working === 'own' || pendingOwn ? 'own' : 'default'

  const choose = (next: Choice) => {
    if (next === selected) return
    if (bot) setConfirm(next)
    else setPendingOwn(next === 'own')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройка</CardTitle>
        <CardDescription>Каким ботом школа пишет родителям в MAX.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <RadioGroup
          value={selected}
          onValueChange={(value) => choose(value as Choice)}
          disabled={!isOwner || setEnabled.isPending}
          className="gap-2 sm:grid-cols-2"
        >
          <BotOption
            value="default"
            title="Бот по умолчанию"
            description="Бот ЕДУДА — ничего настраивать не нужно."
          >
            <BotIdentity
              name="ЕДУДА"
              href={maxBotUrl()}
              avatar={
                // Фон белый, а не `bg-background`: аватар бота в мессенджере один,
                // а тема дашборда к нему отношения не имеет.
                <AvatarFallback className="text-primary bg-white" aria-label="ЕДУДА">
                  <Logo className="size-8" />
                </AvatarFallback>
              }
            />
            {working === 'default' && <Badge variant="success">Работает</Badge>}
          </BotOption>

          <BotOption
            value="own"
            title="Свой бот"
            description="Бот вашей школы — в чате родители видят её имя и аватар."
          >
            {bot ? (
              <>
                <BotIdentity
                  name={bot.name ?? bot.username}
                  href={maxBotUrl(bot.username)}
                  avatar={
                    <>
                      {bot.avatarUrl && <AvatarImage src={bot.avatarUrl} alt="" />}
                      <AvatarFallback>{initialOf(bot)}</AvatarFallback>
                    </>
                  }
                />
                {working === 'own' && <Badge variant="success">Работает</Badge>}
              </>
            ) : selected === 'own' ? (
              <>
                <span className="text-muted-foreground text-xs/relaxed">
                  Введите токен бота ниже
                </span>
                <Badge variant="warning">Не сохранён</Badge>
              </>
            ) : (
              <span className="text-muted-foreground text-xs/relaxed">Не подключён</span>
            )}
          </BotOption>
        </RadioGroup>

        {isOwner && selected === 'own' && !bot && (
          <ConnectBot onSaved={() => setPendingOwn(false)} />
        )}
      </CardContent>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm === 'own' && bot ? (
            <AlertDialogHeader>
              <AlertDialogTitle>Рассылать через {bot.name ?? `@${bot.username}`}?</AlertDialogTitle>
              <AlertDialogDescription>
                Напоминания пойдут через бота школы с ближайшей рассылки. Родители, подключённые
                только к боту ЕДУДА, перестанут их получать, пока не нажмут «Отправить номер» в боте
                школы.
              </AlertDialogDescription>
            </AlertDialogHeader>
          ) : (
            <AlertDialogHeader>
              <AlertDialogTitle>Вернуться на бота ЕДУДА?</AlertDialogTitle>
              <AlertDialogDescription>
                Напоминания пойдут через бота ЕДУДА с ближайшей рассылки. Родители, подключённые
                только к боту школы, перестанут их получать, пока не подключатся к боту ЕДУДА. Бот
                школы сохранится — вернуть его можно без повторного ввода токена.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={setEnabled.isPending}
              onClick={() =>
                setEnabled.mutate(
                  { enabled: confirm === 'own' },
                  { onSettled: () => setConfirm(null) },
                )
              }
            >
              {confirm === 'own' ? 'Переключить' : 'Вернуться'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

/**
 * Карточка варианта — та же разметка, что у режимов в «Когда отправлять»: радио
 * и заголовок, пояснение, а снизу за чертой — какой это бот и работает ли он.
 */
function BotOption({
  value,
  title,
  description,
  children,
}: {
  value: Choice
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <label className="has-data-checked:border-primary flex cursor-pointer flex-col gap-1.5 rounded-lg border p-2.5 transition-colors">
      <div className="flex items-center gap-2.5">
        <RadioGroupItem value={value} />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-muted-foreground text-xs">{description}</p>
      <div className="mt-auto flex min-h-12.5 items-center justify-between gap-2.5 border-t pt-2.5">
        {children}
      </div>
    </label>
  )
}

function BotIdentity({
  name,
  href,
  avatar,
}: {
  name: string
  href: string | null
  avatar: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar>{avatar}</Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs/relaxed font-medium">{name}</span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            // Ссылка лежит внутри `label`: без этого клик по ней заодно выбирал бы вариант.
            onClick={(event) => event.stopPropagation()}
            className="text-primary inline-flex w-fit items-center gap-1 text-xs/relaxed hover:underline"
          >
            {href.replace(/^https?:\/\//, '')}
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}

/**
 * Подключение своего бота. Шаги у школы перед формой, а не в документации:
 * пропущенный адрес мини-приложения ничего не ломает при подключении, а
 * обнаруживается только тогда, когда родитель не может открыть кабинет из чата.
 *
 * «Сохранить» открывается только после «Теста», и только для того токена,
 * который проверяли: поменяли поле — проверять заново.
 */
function ConnectBot({ onSaved }: { onSaved: () => void }) {
  const test = useTestMaxBotMutation()
  const connect = useConnectMaxBotMutation()
  const form = useForm<MaxBotTokenSchemaType>({
    resolver: zodResolver(MaxBotTokenSchema),
    defaultValues: { token: '' },
  })

  const token = useWatch({ control: form.control, name: 'token' }).trim()
  const forToken = test.variables?.token === token
  const tested: MaxBotProfile | null = forToken && test.data ? test.data : null
  const testError = forToken && test.error ? test.error.message : null

  const runTest = form.handleSubmit((values) => test.mutate(values))
  const save = form.handleSubmit((values) =>
    connect.mutate(values, {
      onSuccess: () => {
        form.reset()
        onSaved()
      },
    }),
  )

  return (
    <form onSubmit={runTest} className="flex flex-col gap-4">
      <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs/relaxed">
        <li>
          Создайте бота на платформе MAX для партнёров — от имени организации, ИП или самозанятого.
        </li>
        <li>
          В настройках бота укажите адрес мини-приложения:{' '}
          <span className="text-foreground font-mono break-all">{parentCabinetUrl('max')}</span>
        </li>
        <li>
          Не подключайте этого бота к CRM и другим сервисам — он должен работать только с ЕДУДА.
        </li>
        <li>Вставьте токен бота ниже и нажмите «Тест».</li>
      </ol>

      <Controller
        control={form.control}
        name="token"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor="max-bot-token">Токен бота</FieldLabel>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <PasswordInput id="max-bot-token" autoComplete="off" {...field} />
              </div>
              <Button type="submit" variant="outline" disabled={test.isPending}>
                {test.isPending && <Loader className="animate-spin" />}
                Тест
              </Button>
            </div>
            {tested && (
              <div className="flex flex-wrap items-center gap-2 text-xs/relaxed">
                <span className="text-success inline-flex items-center gap-1">
                  <Check className="size-3.5" />
                  Токен подходит
                </span>
                <Avatar size="sm">
                  {tested.avatarUrl && <AvatarImage src={tested.avatarUrl} alt="" />}
                  <AvatarFallback>{initialOf(tested)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{tested.name ?? tested.username}</span>
                <span className="text-muted-foreground">@{tested.username}</span>
              </div>
            )}
            {(fieldState.error || testError) && (
              <FieldError>{fieldState.error?.message ?? testError}</FieldError>
            )}
            <FieldDescription>
              Токен проверяет сам MAX. После сохранения его не видно никому — ни владельцу, ни
              управляющему.
            </FieldDescription>
          </Field>
        )}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={!tested || connect.isPending}>
          {connect.isPending && <Loader className="animate-spin" />}
          Сохранить
        </Button>
        {!tested && (
          <span className="text-muted-foreground text-xs/relaxed">
            Сначала проверьте токен. До сохранения родителям пишет бот ЕДУДА.
          </span>
        )}
      </div>
    </form>
  )
}
