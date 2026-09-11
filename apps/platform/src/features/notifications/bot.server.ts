import { encryptBotToken } from '@repo/core/max-bots'
import type { Prisma } from '@repo/db'
import { ConflictError } from '@/src/lib/error'

/**
 * Собственный бот MAX школы: прочитать, подключить, отключить.
 *
 * Клиент первым параметром и без `server-only` — как остальные ядра фичи: так
 * это зовёт и экшен, и `scripts/check-reminders.ts`. Токен наружу не отдаётся
 * никогда: после сохранения его не видит ни владелец, ни управляющий.
 */

export type MaxBotInfo = { username: string } | null

export async function readMaxBot(
  db: Prisma.TransactionClient,
  organizationId: number,
): Promise<MaxBotInfo> {
  return db.organizationMaxBot.findUnique({
    where: { organizationId },
    select: { username: true },
  })
}

/** Что MAX говорит о боте по токену. Параметром — чтобы проверка не ходила в сеть. */
export type MaxMe = (
  token: string,
) => Promise<{ ok: true; username: string | null } | { ok: false; status: number | null }>

export const fetchMaxMe: MaxMe = async (token) => {
  try {
    const response = await fetch('https://platform-api2.max.ru/me', {
      // Именно так: без `Bearer` MAX отвечает 401 при живом токене.
      headers: { Authorization: token },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return { ok: false, status: response.status }

    const me = (await response.json()) as { username?: string | null }
    return { ok: true, username: me.username ?? null }
  } catch (error) {
    // `fetch failed` без статуса у MAX — почти всегда TLS: корню Минцифры
    // процесс не доверяет, нужен `NODE_EXTRA_CA_CERTS` в записи pm2 платформы.
    console.error('notifications: MAX /me недоступен —', String(error))
    return { ok: false, status: null }
  }
}

/**
 * Подключает бота: проверяет токен у самого MAX и сохраняет его зашифрованным.
 * Проверка здесь, а не на первом проходе крона: неверный токен школа должна
 * увидеть сразу, а не через десять минут по молчанию бота.
 *
 * ponytail: смена бота на другого не гасит привязки к прежнему — первое же
 * напоминание им вернёт отказ MAX, и дренаж погасит их сам. Гасить сразу —
 * когда школы начнут менять ботов.
 */
export async function connectMaxBot(
  db: Prisma.TransactionClient,
  organizationId: number,
  token: string,
  me: MaxMe = fetchMaxMe,
): Promise<{ username: string }> {
  const answer = await me(token)
  if (!answer.ok) {
    throw new ConflictError(
      answer.status === 401
        ? 'MAX не принял токен. Скопируйте его заново в разделе бота на платформе MAX для партнёров.'
        : 'Не удалось связаться с MAX. Попробуйте ещё раз через пару минут.',
    )
  }
  if (!answer.username) {
    throw new ConflictError(
      'У бота нет публичного имени, а без него родителям не дать ссылку. Задайте имя в настройках бота.',
    )
  }

  // Один бот на две школы — это каждое событие дважды: у каждой своя подписка
  // на вебхук, и на «Начать» родитель получил бы два приветствия.
  if (answer.username === process.env.NEXT_PUBLIC_MAX_BOT) {
    throw new ConflictError('Это бот ЕДУДА. Подключите отдельного бота своей школы.')
  }
  const taken = await db.organizationMaxBot.findFirst({
    where: { username: answer.username, organizationId: { not: organizationId } },
    select: { organizationId: true },
  })
  if (taken) {
    throw new ConflictError('Этот бот уже подключён к другой школе.')
  }

  const tokenEnc = encryptBotToken(token)
  const bot = await db.organizationMaxBot.upsert({
    where: { organizationId },
    create: { organizationId, tokenEnc, username: answer.username },
    update: { tokenEnc, username: answer.username },
    select: { username: true },
  })

  console.log(`notifications: школа ${organizationId} подключила бота @${bot.username}`)
  return bot
}

/**
 * Отключает бота. Привязки родителей к нему остаются: подключит школа этого же
 * бота снова — они заработают. С этого момента рассылка идёт через привязки к
 * боту ЕДУДА.
 */
export async function disconnectMaxBot(
  db: Prisma.TransactionClient,
  organizationId: number,
): Promise<boolean> {
  const { count } = await db.organizationMaxBot.deleteMany({ where: { organizationId } })
  if (count > 0) console.log(`notifications: школа ${organizationId} отключила своего бота`)
  return count > 0
}
