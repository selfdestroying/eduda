'use client'

import { Button } from '@/src/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/src/components/ui/item'
import { ymdToLocalDate } from '@/src/lib/timezone'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { BellOff } from 'lucide-react'
import Link from 'next/link'
import { useCreateSnoozedAlertMutation } from '../queries'
import { ALERT_TYPE, type SmartFeedAlert } from '../types'
import { SnoozeDaysMenu } from './snooze-days-menu'

interface FeedCardProps {
  alert: SmartFeedAlert
}

export function FeedCard({ alert }: FeedCardProps) {
  switch (alert.type) {
    case ALERT_TYPE.UNMARKED_ATTENDANCE:
      return <UnmarkedAttendanceCard alert={alert} />
    case ALERT_TYPE.LOW_BALANCE:
      return <LowBalanceCard alert={alert} />
    case ALERT_TYPE.CONSECUTIVE_ABSENCES:
      return <AbsentStreakCard alert={alert} />
  }
}

function UnmarkedAttendanceCard({
  alert,
}: {
  alert: SmartFeedAlert & { type: 'UNMARKED_ATTENDANCE' }
}) {
  const formattedDate = format(ymdToLocalDate(alert.lessonDate), 'd MMM', { locale: ru })

  return (
    <Item size={'xs'}>
      <ItemContent>
        <ItemTitle>
          <Link
            href={`/groups/${alert.groupId}`}
            className="hover:text-primary underline-offset-1 hover:underline"
          >
            {alert.groupName}
          </Link>
        </ItemTitle>
        <ItemDescription>
          {formattedDate}, {alert.lessonTime} · {alert.unspecifiedCount} неотмечен.
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}

function LowBalanceCard({ alert }: { alert: SmartFeedAlert & { type: 'LOW_BALANCE' } }) {
  const snoozeMutation = useCreateSnoozedAlertMutation()

  return (
    <Item size={'xs'}>
      <ItemContent>
        <ItemTitle>
          <Link
            href={`/students/${alert.studentId}`}
            className="hover:text-primary underline-offset-1 hover:underline"
          >
            {alert.studentName}
          </Link>
        </ItemTitle>
        <ItemDescription className="line-clamp-0 [&>a]:no-underline [&>a]:underline-offset-1 [&>a]:hover:underline">
          <Link
            href={`/groups/${alert.groupId}`}
            className="hover:text-primary underline-offset-1 hover:underline"
          >
            {alert.groupName}
          </Link>
          <span className="text-destructive ml-1">
            {alert.lessonsBalance} {declLessons(alert.lessonsBalance)}
          </span>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
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
      </ItemActions>
    </Item>
  )
}

function AbsentStreakCard({ alert }: { alert: SmartFeedAlert & { type: 'CONSECUTIVE_ABSENCES' } }) {
  return (
    <Item size={'xs'}>
      <ItemContent className="truncate">
        <ItemTitle>
          <Link
            href={`/students/${alert.studentId}`}
            className="hover:text-primary underline-offset-1 hover:underline"
          >
            {alert.studentName}
          </Link>
        </ItemTitle>
        <ItemDescription className="line-clamp-0 [&>a]:no-underline [&>a]:underline-offset-1 [&>a]:hover:underline">
          <Link href={`/groups/${alert.groupId}`} className="hover:text-primary">
            {alert.groupName}
          </Link>
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}

function declLessons(n: number): string {
  const abs = Math.abs(n)
  if (abs % 10 === 1 && abs % 100 !== 11) return 'занятие'
  if (abs % 10 >= 2 && abs % 10 <= 4 && (abs % 100 < 10 || abs % 100 >= 20)) return 'занятия'
  return 'занятий'
}
