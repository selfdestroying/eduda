'use client'

import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Switch } from '@repo/ui/components/switch'
import { Loader } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useReminderSettingsQuery, useUpdateReminderSettingsMutation } from '../queries'
import { ReminderSettingsSchema, type ReminderSettingsSchemaType } from '../schemas'

/**
 * Настройки напоминаний школы. Рассылает их бот из `apps/bots`; здесь только
 * три поля, которыми школа решает, включено ли это и когда приходит.
 */
export default function ReminderSettings() {
  const { data, isPending, isError } = useReminderSettingsQuery()

  if (isPending) return <Skeleton className="h-72 w-full rounded-xl" />
  if (isError || !data) {
    return (
      <p className="text-muted-foreground text-sm">
        Не удалось загрузить настройки. Обновите страницу.
      </p>
    )
  }

  return <SettingsForm settings={data} />
}

function SettingsForm({ settings }: { settings: ReminderSettingsSchemaType }) {
  const tz = useOrgTimezone()
  const mutation = useUpdateReminderSettingsMutation()

  const form = useForm<ReminderSettingsSchemaType>({
    resolver: zodResolver(ReminderSettingsSchema),
    defaultValues: settings,
  })

  const enabled = form.watch('remindersEnabled')

  return (
    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <Card>
        <CardHeader>
          <CardTitle>Напоминания о занятиях</CardTitle>
          <CardDescription>
            Бот пишет родителю, у которого завтра или сегодня занятие. Подключается родитель сам —
            ссылка есть в его личном кабинете, а её статус виден в карточке ученика.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <Controller
              control={form.control}
              name="remindersEnabled"
              render={({ field }) => (
                <Field>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="reminders-enabled"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <FieldLabel htmlFor="reminders-enabled">Присылать напоминания</FieldLabel>
                  </div>
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="reminderLeadDays"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="reminder-lead">Когда напоминать</FieldLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                    disabled={!enabled}
                  >
                    <SelectTrigger id="reminder-lead">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Накануне</SelectItem>
                      <SelectItem value="0">Утром в день занятия</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="reminderTime"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="reminder-time">Во сколько отправлять</FieldLabel>
                  <Input
                    id="reminder-time"
                    type="time"
                    className="w-40"
                    disabled={!enabled}
                    {...field}
                  />
                  <p className="text-muted-foreground text-sm">
                    По времени школы ({tz}). Сервер был недоступен в этот час — напоминания уйдут
                    позже в тот же день, а не пропадут.
                  </p>
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
            {mutation.isPending && <Loader className="animate-spin" />}
            Сохранить
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
