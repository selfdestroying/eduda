'use client'

import { formatDate, formatDateOnly } from '@/src/lib/timezone'
import { getFullName, getGroupName } from '@/src/lib/utils'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@repo/ui/components/item'
import { Skeleton } from '@repo/ui/components/skeleton'
import { StatCard } from '@repo/ui/components/stat-card'
import { CalendarCheck, Clock, MapPin, TriangleAlert, Wallet } from 'lucide-react'
import Link from 'next/link'
import { attendanceStats, financeTotals, LOW_BALANCE, upcomingLessons } from '../lib'
import {
  usePublicStudentDataQuery,
  usePublicStudentFinancesQuery,
  usePublicStudentGroupsQuery,
  useSelectedChild,
} from '../queries'
import { CabinetEmpty, NoChildren } from './cabinet-empty'

export default function CabinetHome({ token }: { token: string }) {
  const {
    studentId,
    childQuery,
    isPending: childPending,
    isError: childError,
  } = useSelectedChild(token)

  const student = usePublicStudentDataQuery(token, studentId)
  const finances = usePublicStudentFinancesQuery(token, studentId)
  const groups = usePublicStudentGroupsQuery(token, studentId)

  if (childError) {
    return (
      <CabinetEmpty
        title="Ссылка недействительна"
        description="Возможно, она устарела. Запросите новую у администратора школы."
      />
    )
  }

  // Хуки ниже включаются только при известном ребёнке (`enabled: studentId != null`),
  // поэтому без этой проверки родитель без детей завис бы на скелетоне.
  if (!childPending && studentId == null) {
    return <NoChildren />
  }

  if (childPending || student.isPending || finances.isPending || groups.isPending) {
    return <HomeSkeleton />
  }

  if (
    student.isError ||
    finances.isError ||
    groups.isError ||
    !student.data ||
    !finances.data ||
    !groups.data
  ) {
    return (
      <CabinetEmpty
        title="Не удалось загрузить данные"
        description="Попробуйте обновить страницу."
      />
    )
  }

  const { balance } = financeTotals(finances.data)
  const { present, marked, rate } = attendanceStats(groups.data.groups)
  // «Сегодня» считает сервер в поясе школы и отдаёт вместе с занятиями — так
  // ближайшие занятия и проверки в кабинете смотрят на одну и ту же дату.
  const upcoming = upcomingLessons(groups.data.groups, groups.data.today)
  const next = upcoming[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getFullName(student.data.firstName, student.data.lastName)}
        </h1>
        <p className="text-muted-foreground text-sm">Личный кабинет родителя</p>
      </div>

      {balance <= LOW_BALANCE && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Заканчиваются оплаченные занятия</AlertTitle>
          <AlertDescription>
            {balance > 0
              ? `Осталось ${balance} ${plural(balance, 'занятие', 'занятия', 'занятий')}. Пора продлить оплату.`
              : 'Оплаченные занятия закончились. Свяжитесь со школой, чтобы продлить обучение.'}
          </AlertDescription>
          <AlertAction>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href={`/cabinet/${token}/finances${childQuery}`} />}
            >
              Финансы
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Остаток занятий"
          value={balance}
          icon={Wallet}
          variant={balance <= LOW_BALANCE ? 'danger' : 'default'}
        />
        <StatCard
          label="Посещаемость"
          value={rate == null ? '—' : `${rate}%`}
          description={rate == null ? 'Занятий пока не отмечали' : `${present} из ${marked}`}
          icon={CalendarCheck}
          hint="Считается только по отмеченным занятиям."
        />
        <StatCard
          label="Следующее занятие"
          value={next ? formatDate(next.date) : '—'}
          description={
            next
              ? [next.time, getGroupName(next.group)].filter(Boolean).join(' · ')
              : 'Занятий не запланировано'
          }
          icon={Clock}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Ближайшие занятия</h2>
        {upcoming.length === 0 ? (
          <CabinetEmpty
            title="Ближайших занятий нет"
            description="Как только школа поставит занятия в расписание, они появятся здесь."
          />
        ) : (
          <ItemGroup>
            {upcoming.map((lesson) => (
              <Item key={lesson.id} variant="muted">
                <ItemContent>
                  <ItemTitle>{getGroupName(lesson.group)}</ItemTitle>
                  <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="tabular-nums">
                      {formatDateOnly(lesson.date, {
                        day: 'numeric',
                        month: 'long',
                        weekday: 'short',
                      })}
                      {lesson.time ? `, ${lesson.time}` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {lesson.group.location.name}
                    </span>
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>

      <p className="text-muted-foreground text-xs">
        Ссылка на кабинет уникальна и открывает данные ваших детей. Не пересылайте её посторонним.
      </p>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="col-span-2 h-20 rounded-lg sm:col-span-1" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  )
}

/** Русская форма числительного: 1 занятие, 2 занятия, 5 занятий. */
function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
