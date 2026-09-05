/**
 * Декорации для экрана «Напоминания»: привязки во всех состояниях и очередь со
 * всеми исходами — чтобы проверить страницу глазами, не дожидаясь, пока школа
 * накопит историю сама.
 *
 * Только для дев-базы. Вхолостую по умолчанию, пишет по `--apply`, убирает за
 * собой по `--clean`: и привязки, и строки очереди помечены префиксом
 * `demo-reminder`, так что чистка не заденет настоящие.
 *
 *   pnpm --filter platform exec tsx scripts/seed-reminder-demo.ts --org=alg
 *   pnpm --filter platform exec tsx scripts/seed-reminder-demo.ts --org=alg --apply
 *   pnpm --filter platform exec tsx scripts/seed-reminder-demo.ts --org=alg --clean --apply
 */
import './load-env'

import { prisma } from '@repo/db'
import type { MessengerProvider, NotificationStatus } from '@repo/db/enums'
import { addMinutes, subDays } from 'date-fns'

const MARK = 'demo-reminder'

const apply = process.argv.includes('--apply')
const clean = process.argv.includes('--clean')
const slug = process.argv.find((a) => a.startsWith('--org='))?.slice('--org='.length) ?? 'alg'

/** Привязки: по одной на каждое состояние, которое умеет показать список родителей. */
const LINKS = [
  { key: 'vk', provider: 'VK', unsubscribed: false },
  { key: 'max', provider: 'MAX', unsubscribed: false },
  // Два канала у одного родителя — в строке два бейджа.
  { key: 'both-vk', provider: 'VK', unsubscribed: false },
  { key: 'both-max', provider: 'MAX', unsubscribed: false },
  // Подключался и отписался: «почему мне перестало приходить».
  { key: 'gone', provider: 'VK', unsubscribed: true },
  // Погашен дренажем после VK 901 — у него же в журнале лежит эта ошибка.
  { key: 'blocked', provider: 'VK', unsubscribed: true },
] satisfies Array<{ key: string; provider: MessengerProvider; unsubscribed: boolean }>

/** Кому из родителей какая привязка. Индекс — в списке отобранных родителей. */
const LINK_OWNER: Record<string, number> = {
  vk: 0,
  max: 1,
  'both-vk': 2,
  'both-max': 2,
  gone: 3,
  blocked: 4,
}

const ONE_CHILD = ['Завтра, 5 сентября', '', '• Аня — Программирование, 17:00, Центр', ''].join(
  '\n',
)

const TWO_CHILDREN = [
  'Завтра, 5 сентября',
  '',
  '• Аня — Программирование, 17:00, Центр',
  '• Миша — Робототехника, 18:30, Центр',
  '',
].join('\n')

/** Хвост дефолтного шаблона — декорации должны выглядеть как настоящие письма. */
const TAIL = ['Не сможете прийти — отметьте в кабинете.', '', 'Отключить напоминания — /stop'].join(
  '\n',
)

/**
 * Очередь: каждый исход по разу, плюс даты по обе стороны от семидневного окна
 * сводки — иначе «Отправлено за 7 дней» и фильтр по периоду нечем проверить.
 */
const QUEUE = [
  { key: 'vk', suffix: 'sent-today', status: 'SENT', daysAgo: 0, text: ONE_CHILD },
  { key: 'max', suffix: 'sent-today-max', status: 'SENT', daysAgo: 0, text: TWO_CHILDREN },
  { key: 'both-vk', suffix: 'sent-3d', status: 'SENT', daysAgo: 3, text: ONE_CHILD },
  // Старее окна сводки: в счётчик «за 7 дней» не попадает, в журнале виден.
  { key: 'both-max', suffix: 'sent-40d', status: 'SENT', daysAgo: 40, text: TWO_CHILDREN },
  {
    key: 'max',
    suffix: 'failed-chat',
    status: 'FAILED',
    daysAgo: 1,
    text: ONE_CHILD,
    attempts: 5,
    error: 'MAX 404: chat.not.found',
  },
  {
    key: 'blocked',
    suffix: 'failed-901',
    status: 'FAILED',
    daysAgo: 2,
    text: ONE_CHILD,
    attempts: 1,
    error: 'VK 901: пользователь запретил сообщения от сообщества',
  },
  {
    key: 'gone',
    suffix: 'failed-provider',
    status: 'FAILED',
    daysAgo: 4,
    text: TWO_CHILDREN,
    attempts: 1,
    error: 'провайдер VK не подключён',
  },
  // Длинная ошибка — проверка обрезки в колонке и подсказки по наведению.
  {
    key: 'vk',
    suffix: 'failed-long',
    status: 'FAILED',
    daysAgo: 5,
    text: ONE_CHILD,
    attempts: 5,
    error:
      'TypeError: fetch failed — unable to get local issuer certificate (platform-api2.max.ru); проверьте NODE_EXTRA_CA_CERTS в записи pm2',
  },
  { key: 'vk', suffix: 'pending-fresh', status: 'PENDING', daysAgo: 0, text: ONE_CHILD },
  {
    key: 'both-max',
    suffix: 'pending-retry',
    status: 'PENDING',
    daysAgo: 0,
    text: TWO_CHILDREN,
    attempts: 2,
    retryInMinutes: 30,
    error: 'MAX 502: bad gateway',
  },
] satisfies Array<{
  key: string
  suffix: string
  status: NotificationStatus
  daysAgo: number
  text: string
  attempts?: number
  retryInMinutes?: number
  error?: string
}>

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } })
  if (!org) throw new Error(`Организации «${slug}» нет`)

  if (clean) {
    const outbox = { organizationId: org.id, dedupeKey: { startsWith: `${MARK}:` } }
    const links = { organizationId: org.id, externalId: { startsWith: `${MARK}-` } }

    if (!apply) {
      console.log(
        `нашлось: строк очереди ${await prisma.notificationOutbox.count({ where: outbox })}, ` +
          `привязок ${await prisma.parentMessenger.count({ where: links })}. ` +
          'Вхолостую — ничего не удалено. Повторите с --apply',
      )
      return
    }

    const removedOutbox = await prisma.notificationOutbox.deleteMany({ where: outbox })
    const removedLinks = await prisma.parentMessenger.deleteMany({ where: links })
    console.log(`убрано: строк очереди ${removedOutbox.count}, привязок ${removedLinks.count}`)
    return
  }

  // Родители с учениками: иначе в списке пустая колонка «Ученики», а проверять
  // надо как раз строку целиком.
  const parents = await prisma.parent.findMany({
    where: { organizationId: org.id, students: { some: {} } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { id: 'asc' },
    take: 5,
  })
  if (parents.length < 5) throw new Error(`В «${slug}» меньше пяти родителей с учениками`)

  const now = new Date()
  console.log(`организация ${slug} (#${org.id}), родители: ${parents.map((p) => p.id).join(', ')}`)
  console.log(`привязок ${LINKS.length}, строк очереди ${QUEUE.length}`)

  if (!apply) {
    console.log('вхолостую — ничего не записано. Повторите с --apply')
    return
  }

  const linkIds = new Map<string, number>()
  for (const link of LINKS) {
    const parentId = parents[LINK_OWNER[link.key]!]!.id
    const row = await prisma.parentMessenger.upsert({
      where: {
        provider_externalId_parentId: {
          provider: link.provider,
          externalId: `${MARK}-${link.key}`,
          parentId,
        },
      },
      create: {
        provider: link.provider,
        externalId: `${MARK}-${link.key}`,
        parentId,
        organizationId: org.id,
        createdAt: subDays(now, 20),
        unsubscribedAt: link.unsubscribed ? subDays(now, 2) : null,
      },
      update: { unsubscribedAt: link.unsubscribed ? subDays(now, 2) : null },
      select: { id: true },
    })
    linkIds.set(link.key, row.id)
  }

  await prisma.notificationOutbox.createMany({
    data: QUEUE.map((row) => {
      const createdAt = subDays(now, row.daysAgo)
      return {
        kind: 'LESSON_REMINDER',
        dedupeKey: `${MARK}:${row.suffix}`,
        text: `${row.text}\n${TAIL}`,
        status: row.status,
        attempts: row.attempts ?? (row.status === 'SENT' ? 1 : 0),
        lastError: row.error ?? null,
        sentAt: row.status === 'SENT' ? addMinutes(createdAt, 1) : null,
        nextAttemptAt: row.retryInMinutes ? addMinutes(now, row.retryInMinutes) : createdAt,
        createdAt,
        organizationId: org.id,
        parentMessengerId: linkIds.get(row.key)!,
      }
    }),
    // Повторный прогон ничего не задваивает: ключ у строки свой.
    skipDuplicates: true,
  })

  console.log('готово')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
