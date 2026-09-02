import type { Prisma } from '@repo/db'
import type { MessengerProvider } from '@repo/db/enums'
import type { SendResult } from './providers/vk'

/**
 * Дренаж очереди: берёт то, чему подошёл срок, и отправляет по одному.
 *
 * По одному, а не пачкой, потому что провайдеры считают запросы в секунду
 * (VK — 20, MAX — 30), и потому что упавшая отправка не должна утаскивать за
 * собой те, что прошли.
 */

export type Sender = (externalId: string, text: string, randomId: number) => Promise<SendResult>

/**
 * Пауза между отправками: ≈16 в секунду, под лимитом обоих мессенджеров.
 *
 * ponytail: одна общая пауза на всех провайдеров вместо счётчика на каждого.
 * Считать по провайдерам — когда в очереди появятся тысячи строк за прогон.
 */
const PAUSE_MS = 60

/** Сколько строк за один заход. Крон приходит каждые десять минут. */
const LIMIT = 200

/**
 * Задержки перед повтором. Длина на единицу меньше `MAX_ATTEMPTS`: после
 * последней задержки идёт не пятая пауза, а отказ.
 */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]

const MAX_ATTEMPTS = 5

export type DrainResult = { sent: number; failed: number; retried: number }

export async function drainOutbox(
  db: Prisma.TransactionClient,
  senders: Partial<Record<MessengerProvider, Sender>>,
  options: { now?: Date; limit?: number; pauseMs?: number } = {},
): Promise<DrainResult> {
  const now = options.now ?? new Date()
  const pauseMs = options.pauseMs ?? PAUSE_MS

  const rows = await db.notificationOutbox.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: now } },
    orderBy: { id: 'asc' },
    take: options.limit ?? LIMIT,
    select: {
      id: true,
      text: true,
      attempts: true,
      parentMessenger: { select: { id: true, provider: true, externalId: true } },
    },
  })

  const result: DrainResult = { sent: 0, failed: 0, retried: 0 }

  for (const [index, row] of rows.entries()) {
    if (index > 0 && pauseMs > 0) await sleep(pauseMs)

    const { provider, externalId } = row.parentMessenger
    const send = senders[provider]

    // Привязка есть, а отправлять нечем: провайдер не подключён в этой сборке.
    // Ретраить бессмысленно — само не появится.
    const outcome: SendResult = send
      ? // `randomId` — id строки: у VK это ключ идемпотентности, поэтому
        // повтор после таймаута не задваивает сообщение.
        await send(externalId, row.text, row.id)
      : { ok: false, retryable: false, error: `провайдер ${provider} не подключён` }

    if (outcome.ok) {
      await db.notificationOutbox.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: now, lastError: null },
      })
      result.sent += 1
      continue
    }

    if (outcome.blocked) {
      // Не ошибка доставки, а отписка: родитель запретил сообщения. Гасим
      // привязку, иначе следующий план снова наберёт ему напоминаний.
      await db.parentMessenger.update({
        where: { id: row.parentMessenger.id },
        data: { unsubscribedAt: now },
      })
    }

    const attempt = row.attempts + 1
    const giveUp = outcome.blocked || !outcome.retryable || attempt >= MAX_ATTEMPTS

    await db.notificationOutbox.update({
      where: { id: row.id },
      data: {
        attempts: attempt,
        lastError: outcome.error,
        ...(giveUp
          ? { status: 'FAILED' as const }
          : { nextAttemptAt: new Date(now.getTime() + BACKOFF_MS[attempt - 1]!) }),
      },
    })

    if (giveUp) result.failed += 1
    else result.retried += 1
  }

  return result
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
