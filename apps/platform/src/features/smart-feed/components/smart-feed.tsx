'use client'

import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/empty'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover'
import { useSidebar } from '@repo/ui/components/sidebar'
import { formatDateOnly } from '@/src/lib/timezone'
import { Skeleton } from '@repo/ui/components/skeleton'
import { GlobalSearch } from '@/src/features/search/components/global-search'
import { useOrgTimezone } from '@/src/hooks/use-org-timezone'
import { nowInTz } from '@/src/lib/timezone'
import { cn } from '@/src/lib/utils'
import {
  Ban,
  BellOff,
  CalendarOff,
  CircleAlert,
  ClipboardList,
  Menu,
  RotateCcw,
  SquareArrowOutUpRight,
  UserX,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import {
  useAbsentStreaksQuery,
  useCreateSnoozedAlertMutation,
  useCreateSnoozedAlertsBulkMutation,
  useLowBalanceQuery,
  useParentMarkedAbsencesQuery,
  useRestoreSnoozedAlertsBulkMutation,
  useSnoozedAlertsQuery,
  useUnmarkedAttendnace,
  useUnpaidStudentsQuery,
} from '../queries'
import { type SmartFeedAlert, UNPAID_SNOOZE_KEY } from '../types'
import { QuickTip } from './quick-tip'
import { SnoozeDaysMenu, type SnoozeDaysOption } from './snooze-days-menu'

// ─── Desktop info bar ──────────────────────────────────────────────────

export function SmartFeedBar({ canSeeFeed }: { canSeeFeed: boolean }) {
  const { isMobile, toggleSidebar } = useSidebar()
  const tz = useOrgTimezone()
  const now = useMemo(() => nowInTz(tz), [tz])
  const greeting = getGreeting(now)

  return (
    <div className="flex w-full items-center gap-2">
      {/* Left: greeting */}
      <div className="flex h-full min-w-0 flex-1 items-center gap-2">
        <p className="text-muted-foreground truncate text-xs">{greeting}</p>
        <QuickTip />
      </div>

      {/* Center: global search */}
      <GlobalSearch />

      {/* Right: alerts / sidebar toggle */}
      <div className="flex flex-1 items-center justify-end gap-2">
        {canSeeFeed && !isMobile && (
          <div className="grid auto-cols-max grid-flow-col items-center gap-2">
            <UnmarkedAttendanceChip />
            <UnpaidChip />
            <LowBalanceChip />
            <AbsentStreaksChip />
            <ParentMarkedChip />
            <Button
              variant="outline"
              size="icon"
              render={<Link href="/smart-feed" />}
              nativeButton={false}
            >
              <SquareArrowOutUpRight />
            </Button>
          </div>
        )}
        {isMobile && <SidebarToggle onClick={toggleSidebar} />}
      </div>
    </div>
  )
}

export function UnmarkedAttendanceChip() {
  const { data, isLoading, isError } = useUnmarkedAttendnace()
  const amount = data?.length ?? 0

  return (
    <ChipPopover
      amount={amount}
      snoozedAmount={0}
      icon={<ClipboardList />}
      title="Неотмеченные посещения"
      isLoading={isLoading}
      isError={isError}
      description="Группы, в которых не отмечены посещения"
    >
      <ul className="divide-border max-h-80 divide-y overflow-y-auto">
        {data?.map((alert) => (
          <li
            key={`${alert.groupId}`}
            className="flex items-center justify-between gap-2 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div
                className="bg-destructive/10 text-destructive ring-destructive/15 flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums ring-1"
                title="Количество неотмеченных"
              >
                {alert.unspecifiedCount}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  <Link
                    href={`/students/${alert.groupId}`}
                    className="hover:text-primary underline-offset-1 hover:underline"
                  >
                    {alert.groupName}
                  </Link>
                </p>
                <span className="text-muted-foreground truncate text-xs underline-offset-1">
                  {formatDateOnly(alert.lessonDate)} {alert.lessonTime}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </ChipPopover>
  )
}

export function LowBalanceChip() {
  const { data, isLoading, isError } = useLowBalanceQuery()
  const { data: snoozedAlerts } = useSnoozedAlertsQuery('wallet')
  const snoozeAllMutation = useCreateSnoozedAlertsBulkMutation()
  const snoozeMutation = useCreateSnoozedAlertMutation()
  const restoreAllMutation = useRestoreSnoozedAlertsBulkMutation()

  const snoozedCount = snoozedAlerts?.length ?? 0
  const amount = data?.length ?? 0

  const handleSnoozeAll = (days: SnoozeDaysOption) => {
    const items = data!.map((a) => ({ entityId: a.walletId, entityKey: 'wallet' }))
    if (items.length === 0) return
    snoozeAllMutation.mutate({ alerts: items, snoozeDays: days })
  }

  const handleRestoreAll = () => {
    if (!snoozedAlerts || snoozedAlerts.length === 0) return
    restoreAllMutation.mutate({
      alerts: snoozedAlerts.map((a) => ({ entityId: a.entityId, entityKey: a.entityKey })),
    })
  }

  return (
    <ChipPopover
      amount={amount}
      snoozedAmount={snoozedCount}
      snoozeAll={handleSnoozeAll}
      restoreAll={handleRestoreAll}
      icon={<Wallet />}
      title="Низкий баланс"
      isLoading={isLoading}
      isError={isError}
      description="Ученики с низким балансом в кошельке"
    >
      <ul className="divide-border max-h-80 divide-y overflow-y-auto">
        {data?.map((alert) => (
          <li
            key={`${alert.groupId}:${alert.studentId}`}
            className="flex items-center justify-between gap-2 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div
                className="bg-destructive/10 text-destructive ring-destructive/15 flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums ring-1"
                title="Количество уроков"
              >
                {alert.lessonsBalance}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  <Link
                    href={`/students/${alert.studentId}`}
                    className="hover:text-primary underline-offset-1 hover:underline"
                  >
                    {alert.studentName}
                  </Link>
                </p>
                <Link
                  href={`/groups/${alert.groupId}`}
                  className="text-muted-foreground hover:text-primary truncate text-xs underline-offset-1 hover:underline"
                >
                  {alert.groupName}
                </Link>
              </div>
            </div>
            <SnoozeDaysMenu
              onSelect={(days) =>
                snoozeMutation.mutate({
                  entityId: alert.walletId,
                  entityKey: 'wallet',
                  snoozeDays: days,
                })
              }
              trigger={
                <Button
                  variant="ghost"
                  size={'icon'}
                  disabled={snoozeMutation.isPending}
                  title="Отложить"
                />
              }
            >
              <BellOff />
            </SnoozeDaysMenu>
          </li>
        ))}
      </ul>
    </ChipPopover>
  )
}

export function UnpaidChip() {
  const { data, isLoading, isError } = useUnpaidStudentsQuery()
  const { data: snoozedAlerts } = useSnoozedAlertsQuery(UNPAID_SNOOZE_KEY)
  const snoozeAllMutation = useCreateSnoozedAlertsBulkMutation()
  const snoozeMutation = useCreateSnoozedAlertMutation()
  const restoreAllMutation = useRestoreSnoozedAlertsBulkMutation()

  const amount = data?.length ?? 0

  const handleSnoozeAll = (days: SnoozeDaysOption) => {
    const items = (data ?? []).map((a) => ({
      entityId: a.studentId,
      entityKey: UNPAID_SNOOZE_KEY,
    }))
    if (items.length === 0) return
    snoozeAllMutation.mutate({ alerts: items, snoozeDays: days })
  }

  const handleRestoreAll = () => {
    if (!snoozedAlerts || snoozedAlerts.length === 0) return
    restoreAllMutation.mutate({
      alerts: snoozedAlerts.map((a) => ({ entityId: a.entityId, entityKey: a.entityKey })),
    })
  }

  return (
    <ChipPopover
      amount={amount}
      snoozedAmount={snoozedAlerts?.length ?? 0}
      snoozeAll={handleSnoozeAll}
      restoreAll={handleRestoreAll}
      icon={<CircleAlert />}
      title="Долги"
      isLoading={isLoading}
      isError={isError}
      description="Занятия проведены, оплаты под них нет"
    >
      <ul className="divide-border max-h-80 divide-y overflow-y-auto">
        {data?.map((alert) => (
          <li key={alert.studentId} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <div
                className="bg-destructive/10 text-destructive ring-destructive/15 flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums ring-1"
                title="Занятий ждёт оплаты"
              >
                {alert.unpaidCount}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  <Link
                    href={`/students/${alert.studentId}`}
                    className="hover:text-primary underline-offset-1 hover:underline"
                  >
                    {alert.studentName}
                  </Link>
                </p>
                <span className="text-muted-foreground truncate text-xs">
                  с {formatDateOnly(alert.since)} · {alert.groupName}
                </span>
              </div>
            </div>
            <SnoozeDaysMenu
              onSelect={(days) =>
                snoozeMutation.mutate({
                  entityId: alert.studentId,
                  entityKey: UNPAID_SNOOZE_KEY,
                  snoozeDays: days,
                })
              }
              trigger={
                <Button
                  variant="ghost"
                  size={'icon'}
                  disabled={snoozeMutation.isPending}
                  title="Отложить"
                />
              }
            >
              <BellOff />
            </SnoozeDaysMenu>
          </li>
        ))}
      </ul>
    </ChipPopover>
  )
}

export function AbsentStreaksChip() {
  const { data, isLoading, isError } = useAbsentStreaksQuery()
  const amount = data?.length ?? 0

  return (
    <ChipPopover
      amount={amount}
      snoozedAmount={0}
      icon={<UserX />}
      title="Риски"
      isLoading={isLoading}
      isError={isError}
      description="Ученики с 2 пропусками подряд"
    >
      <ul className="divide-border max-h-80 divide-y overflow-y-auto">
        {data?.map((alert) => (
          <li
            key={`${alert.groupId}:${alert.studentId}`}
            className="flex items-center justify-between gap-2 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div
                className="bg-destructive/10 text-destructive ring-destructive/15 flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums ring-1"
                title="Количество пропусков подряд"
              >
                {alert.absenceCount}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  <Link
                    href={`/students/${alert.studentId}`}
                    className="hover:text-primary underline-offset-1 hover:underline"
                  >
                    {alert.studentName}
                  </Link>
                </p>
                <Link
                  href={`/groups/${alert.groupId}`}
                  className="text-muted-foreground hover:text-primary truncate text-xs underline-offset-1 hover:underline"
                >
                  {alert.groupName}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </ChipPopover>
  )
}

export function ParentMarkedChip() {
  const { data, isLoading, isError } = useParentMarkedAbsencesQuery()
  const { data: snoozedAlerts } = useSnoozedAlertsQuery('attendance')
  const snoozeAllMutation = useCreateSnoozedAlertsBulkMutation()
  const snoozeMutation = useCreateSnoozedAlertMutation()
  const restoreAllMutation = useRestoreSnoozedAlertsBulkMutation()

  const snoozedCount = snoozedAlerts?.length ?? 0
  const amount = data?.length ?? 0

  const handleSnoozeAll = (days: SnoozeDaysOption) => {
    const items = data!.map((a) => ({ entityId: a.attendanceId, entityKey: 'attendance' }))
    if (items.length === 0) return
    snoozeAllMutation.mutate({ alerts: items, snoozeDays: days })
  }

  const handleRestoreAll = () => {
    if (!snoozedAlerts || snoozedAlerts.length === 0) return
    restoreAllMutation.mutate({
      alerts: snoozedAlerts.map((a) => ({ entityId: a.entityId, entityKey: a.entityKey })),
    })
  }

  return (
    <ChipPopover
      amount={amount}
      snoozedAmount={snoozedCount}
      snoozeAll={handleSnoozeAll}
      restoreAll={handleRestoreAll}
      icon={<CalendarOff />}
      title="Отметки родителей"
      isLoading={isLoading}
      isError={isError}
      description="Родители предупредили о пропуске будущих занятий"
    >
      <ul className="divide-border max-h-80 divide-y overflow-y-auto">
        {data?.map((alert) => (
          <li
            key={alert.attendanceId}
            className="flex items-center justify-between gap-2 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="bg-destructive/10 text-destructive ring-destructive/15 flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums ring-1"
                title="Дата пропуска"
              >
                {formatDateOnly(alert.lessonDate, { day: '2-digit', month: '2-digit' })}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  <Link
                    href={`/students/${alert.studentId}`}
                    className="hover:text-primary underline-offset-1 hover:underline"
                  >
                    {alert.studentName}
                  </Link>
                </p>
                <Link
                  href={`/lessons/${alert.lessonId}`}
                  className="text-muted-foreground hover:text-primary block truncate text-xs underline-offset-1 hover:underline"
                >
                  {alert.groupName}, {alert.lessonTime}
                </Link>
                {/* Главное, ради чего менеджер сюда смотрит: нужен ли звонок. */}
                {alert.makeupDate ? (
                  <Link
                    href={`/lessons/${alert.makeupLessonId}`}
                    className="text-muted-foreground hover:text-primary block truncate text-xs underline-offset-1 hover:underline"
                  >
                    Отработка {formatDateOnly(alert.makeupDate)}
                    {alert.makeupTime ? `, ${alert.makeupTime}` : ''}
                  </Link>
                ) : (
                  <span className="text-warning block truncate text-xs">Отработка не выбрана</span>
                )}
              </div>
            </div>
            <SnoozeDaysMenu
              onSelect={(days) =>
                snoozeMutation.mutate({
                  entityId: alert.attendanceId,
                  entityKey: 'attendance',
                  snoozeDays: days,
                })
              }
              trigger={
                <Button
                  variant="ghost"
                  size={'icon'}
                  disabled={snoozeMutation.isPending}
                  title="Отложить"
                />
              }
            >
              <BellOff />
            </SnoozeDaysMenu>
          </li>
        ))}
      </ul>
    </ChipPopover>
  )
}

function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="icon" onClick={onClick}>
      <Menu />
    </Button>
  )
}

// ─── Chip popover (desktop - one per alert type) ───────────────────────

/*
 * Шкала срочности по количеству. Ступеней было четыре — зелёный, жёлтый,
 * оранжевый, красный, — но интентов на неё есть только три, а жёлтый с
 * оранжевым и так соседние тона и различались еле-еле. Свели к трём: «пусто»,
 * «есть», «много». Понадобится средняя ступень обратно — она делается
 * подложкой (`bg-warning/20` против `/10`), а не отдельным цветом.
 */
const chipVariants = {
  none: 'bg-success/10 text-success hover:bg-success/15',
  some: 'bg-warning/10 text-warning hover:bg-warning/15',
  many: 'bg-destructive/10 text-destructive hover:bg-destructive/15',
} as const

function getChipVariant(count: number): keyof typeof chipVariants {
  if (count === 0) return 'none'
  if (count <= 10) return 'some'
  return 'many'
}

function ChipPopover({
  icon,
  title,
  amount,
  snoozedAmount,
  snoozeAll,
  restoreAll,
  isLoading,
  isError,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  amount: number
  snoozedAmount: number
  snoozeAll?: (days: SnoozeDaysOption) => void
  restoreAll?: () => void
  isLoading: boolean
  isError: boolean
  footer?: (alerts: SmartFeedAlert[]) => React.ReactNode
  children?: React.ReactNode
}) {
  if (isLoading) {
    return <Skeleton className="h-full w-10" />
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Badge
            variant={'secondary'}
            className={cn(
              'h-full cursor-pointer rounded-md select-none',
              !isError && chipVariants[getChipVariant(amount)],
            )}
          >
            {icon}
            {isError ? '-' : amount}
          </Badge>
        }
        nativeButton={false}
      />
      <PopoverContent align="end" sideOffset={8} className="w-max min-w-96 justify-start gap-0 p-0">
        <div className="border-border flex w-full items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span className={cn('flex h-3.5 w-3.5 items-center')}>{icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{title}</p>
              <div className="text-muted-foreground truncate text-xs">
                {amount}
                {snoozedAmount > 0 && ` (${snoozedAmount} отложено)`}
              </div>
            </div>
          </div>
          <div>
            {snoozeAll && amount > 0 && (
              <SnoozeDaysMenu
                trigger={<Button size={'icon'} variant={'ghost'} title="Отложить все" />}
                onSelect={snoozeAll}
              >
                <BellOff />
              </SnoozeDaysMenu>
            )}
            {restoreAll && snoozedAmount > 0 && (
              <Button size={'icon'} variant={'ghost'} onClick={restoreAll} title="Восстановить все">
                <RotateCcw />
              </Button>
            )}
          </div>
          {/*<span className={cn('text-xs font-semibold tabular-nums')}>{snoozedCount}</span>*/}
        </div>

        {isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Ban />
              </EmptyMedia>
              <EmptyTitle>Ошибка загрузки</EmptyTitle>
              <EmptyDescription>
                Произошла ошибка при загрузке модуля. Попробуйте обновить страницу.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : amount > 0 ? (
          children
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>{icon}</EmptyMedia>
              <EmptyTitle>Нет уведомлений</EmptyTitle>
              <EmptyDescription>
                {description ?? 'На данный момент нет элементов, требующих внимания.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────

function getGreeting(date: Date): string {
  const h = date.getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}
