import { activeMessengerWhere, currentBotMessengerWhere, hasOwnMaxBot } from '@repo/core/messenger'
import type { Prisma } from '@repo/db'
import { addDays } from 'date-fns'
import { startOfDayInTz, ymdToLocalDate } from '@/src/lib/timezone'
import type { ReminderLogListSchemaType, ReminderParentListSchemaType } from './schemas'
import {
  REMINDER_LOG_SELECT,
  reminderParentSelect,
  type ReminderLogResult,
  type ReminderParentResult,
} from './types'

/**
 * Чтение экрана школы: родители и журнал очереди.
 *
 * Клиент первым параметром и без `server-only` — как остальные ядра фичи: так
 * это зовёт и экшен, и `scripts/check-reminders.ts`.
 *
 * Изоляция ручная: `organizationId` стоит в каждом `where`, автофильтра нет.
 */

// ─── Родители ───────────────────────────────────────────────────────

/**
 * Состояние привязки одного родителя — к боту, которым школа рассылает сейчас.
 * `unsubscribed` — это «строки есть, но ни одной живой»: родитель подключался и
 * отписался, и на «почему мне перестало приходить» отвечает именно оно. `none` —
 * к этому боту не подключался вовсе, даже если был подключён к другому.
 */
function connectionWhere(hasOwnBot: boolean) {
  const current = currentBotMessengerWhere(hasOwnBot)
  const active = activeMessengerWhere(hasOwnBot)

  return {
    connected: { messengers: { some: active } },
    unsubscribed: {
      messengers: { some: { ...current, unsubscribedAt: { not: null } }, none: active },
    },
    none: { messengers: { none: current } },
  } satisfies Record<string, Prisma.ParentWhereInput>
}

/**
 * Поиск: слова через `AND`, каждое слово — `OR` по видимым полям. Иначе
 * «Иванов Пётр» не найдёт никого: имя и фамилия лежат в разных колонках, а
 * ученик — вообще в соседней таблице.
 */
function parentSearchWhere(search: string | undefined): Prisma.ParentWhereInput[] {
  if (!search) return []
  const insensitive = 'insensitive' as const

  return search
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({
      OR: [
        { firstName: { contains: word, mode: insensitive } },
        { lastName: { contains: word, mode: insensitive } },
        { phone: { contains: word } },
        {
          students: {
            some: {
              student: {
                OR: [
                  { firstName: { contains: word, mode: insensitive } },
                  { lastName: { contains: word, mode: insensitive } },
                ],
              },
            },
          },
        },
      ],
    }))
}

const PARENT_ORDER_BY: Record<
  string,
  (dir: Prisma.SortOrder) => Prisma.ParentOrderByWithRelationInput[]
> = {
  parent: (dir) => [{ firstName: dir }, { lastName: dir }],
  phone: (dir) => [{ phone: dir }],
}

export function buildParentWhere(
  organizationId: number,
  hasOwnBot: boolean,
  input: Pick<ReminderParentListSchemaType, 'search' | 'connection'>,
): Prisma.ParentWhereInput {
  const connection = connectionWhere(hasOwnBot)

  return {
    organizationId,
    AND: [
      ...parentSearchWhere(input.search),
      ...(input.connection.length > 0
        ? [{ OR: input.connection.map((key) => connection[key]) }]
        : []),
    ],
  }
}

export async function readReminderParents(
  db: Prisma.TransactionClient,
  organizationId: number,
  input: ReminderParentListSchemaType,
): Promise<ReminderParentResult> {
  const hasOwnBot = await hasOwnMaxBot(db, organizationId)
  const where = buildParentWhere(organizationId, hasOwnBot, input)
  const build = input.sort ? PARENT_ORDER_BY[input.sort.id] : undefined
  const orderBy: Prisma.ParentOrderByWithRelationInput[] = [
    ...(build && input.sort
      ? build(input.sort.desc ? 'desc' : 'asc')
      : [{ firstName: 'asc' as const }, { lastName: 'asc' as const }]),
    // Tie-break обязателен: без него равные имена переставляются при листании,
    // и один родитель показывается на двух страницах подряд.
    { id: 'asc' },
  ]

  const [rows, total] = await Promise.all([
    db.parent.findMany({
      where,
      select: reminderParentSelect(hasOwnBot),
      orderBy,
      skip: input.page * input.pageSize,
      take: input.pageSize,
    }),
    db.parent.count({ where }),
  ])

  return { rows, total }
}

// ─── Журнал ─────────────────────────────────────────────────────────

const LOG_ORDER_BY: Record<
  string,
  (dir: Prisma.SortOrder) => Prisma.NotificationOutboxOrderByWithRelationInput[]
> = {
  createdAt: (dir) => [{ createdAt: dir }],
  sentAt: (dir) => [{ sentAt: dir }],
  status: (dir) => [{ status: dir }],
  attempts: (dir) => [{ attempts: dir }],
}

/**
 * Границы периода для `DateTime`-колонки: `createdAt` — настоящий таймстамп, а
 * период приходит календарными днями школы. Верхняя граница — начало
 * следующего дня и `lt`, иначе последний день периода теряет всё после 00:00.
 */
export function periodBounds(
  tz: string,
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined
  return {
    ...(from && { gte: startOfDayInTz(tz, ymdToLocalDate(from)) }),
    ...(to && { lt: startOfDayInTz(tz, addDays(ymdToLocalDate(to), 1)) }),
  }
}

/** Журнал — вся история отправок, каким бы ботом они ни шли. */
export async function readReminderLog(
  db: Prisma.TransactionClient,
  organizationId: number,
  tz: string,
  input: ReminderLogListSchemaType,
): Promise<ReminderLogResult> {
  const createdAt = periodBounds(tz, input.from, input.to)

  const where: Prisma.NotificationOutboxWhereInput = {
    organizationId,
    ...(createdAt && { createdAt }),
    ...(input.statuses.length > 0 && { status: { in: input.statuses } }),
    AND: parentSearchWhere(input.search).map((clause) => ({ parentMessenger: { parent: clause } })),
  }

  const build = input.sort ? LOG_ORDER_BY[input.sort.id] : undefined
  const orderBy: Prisma.NotificationOutboxOrderByWithRelationInput[] =
    build && input.sort
      ? [...build(input.sort.desc ? 'desc' : 'asc'), { id: 'desc' }]
      : [{ id: 'desc' }]

  const [rows, total] = await Promise.all([
    db.notificationOutbox.findMany({
      where,
      select: REMINDER_LOG_SELECT,
      orderBy,
      skip: input.page * input.pageSize,
      take: input.pageSize,
    }),
    db.notificationOutbox.count({ where }),
  ])

  return { rows, total }
}
