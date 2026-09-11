import type { Prisma } from '@repo/db'

/**
 * Дренаж очереди: берёт то, чему подошёл срок, и отправляет по одному.
 *
 * По одному, а не пачкой, потому что MAX считает запросы в секунду (до 30), и
 * потому что упавшая отправка не должна утаскивать за собой те, что прошли.
 */

/**
 * Ответ провайдера в форме, которая нужна дренажу: не «получилось или нет», а
 * «стоит ли пробовать снова и не отписался ли родитель».
 */
export type SendResult =
  | { ok: true }
  | { ok: false; retryable: boolean; blocked?: boolean; error: string }

export type Sender = (externalId: string, text: string) => Promise<SendResult>

/**
 * Кем отправлять строку. У привязки к боту школы свой токен, поэтому отправитель
 * выбирается по привязке. `null` — бота нет: не заведён бот ЕДУДА, или школа
 * отключила своего после того, как строка была запланирована.
 */
export type SenderFor = (messenger: { ownBot: boolean; organizationId: number }) => Sender | null

/**
 * Пауза между отправками: ≈16 в секунду, с запасом под лимитом MAX.
 *
 * ponytail: одна пауза на всю очередь вместо счётчика запросов. Считать
 * по-настоящему — когда в очереди появятся тысячи строк за прогон.
 */
const PAUSE_MS = 60

/** Сколько строк за один заход. Крон приходит каждые десять минут. */
const LIMIT = 200

/**
 * Бронь строки на время отправки: проход сдвигает её срок вперёд, и соседний
 * проход, дошедший до той же строки, условие захвата уже не выполнит.
 *
 * Нужна, потому что `flock` в кроне держит только `curl`: тот уходит через пять
 * минут, а обработчик продолжает рассылку. Медленный MAX — и следующий крон
 * начинает второй проход по тем же строкам, а ключа идемпотентности у MAX нет.
 * Без брони родитель получил бы одно напоминание дважды.
 *
 * Пятнадцать минут покрывают одну отправку, а не весь проход: запрос к MAX
 * обрывается через десять секунд. Остаётся одно окно — процесс умер между
 * ответом MAX и отметкой «отправлено»; тогда через пятнадцать минут строка уйдёт
 * ещё раз. Без ключа идемпотентности на стороне MAX это не лечится.
 */
const LEASE_MS = 15 * 60_000

/**
 * Задержки перед повтором. Длина на единицу меньше `MAX_ATTEMPTS`: после
 * последней задержки идёт не пятая пауза, а отказ.
 */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]

const MAX_ATTEMPTS = 5

export type DrainResult = { sent: number; failed: number; retried: number }

export async function drainOutbox(
  db: Prisma.TransactionClient,
  senderFor: SenderFor,
  options: { clock?: () => Date; limit?: number; pauseMs?: number } = {},
): Promise<DrainResult> {
  // Время берётся в момент каждого действия, а не один раз на проход: проход по
  // медленному MAX идёт полчаса, и бронь, отсчитанная от его начала, истекла бы
  // раньше, чем её поставили.
  const clock = options.clock ?? (() => new Date())
  const pauseMs = options.pauseMs ?? PAUSE_MS

  const rows = await db.notificationOutbox.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: clock() } },
    orderBy: { id: 'asc' },
    take: options.limit ?? LIMIT,
    select: {
      id: true,
      text: true,
      attempts: true,
      parentMessenger: {
        select: { id: true, ownBot: true, organizationId: true, externalId: true },
      },
    },
  })

  const result: DrainResult = { sent: 0, failed: 0, retried: 0 }

  for (const [index, row] of rows.entries()) {
    if (index > 0 && pauseMs > 0) await sleep(pauseMs)

    const claimedAt = clock()
    const claimed = await db.notificationOutbox.updateMany({
      where: { id: row.id, status: 'PENDING', nextAttemptAt: { lte: claimedAt } },
      data: { nextAttemptAt: new Date(claimedAt.getTime() + LEASE_MS) },
    })
    // Строку уже взял соседний проход — или успел отправить, пока этот стоял.
    if (claimed.count === 0) continue

    const messenger = row.parentMessenger
    const send = senderFor(messenger)

    // Привязка есть, а отправлять нечем. Ретраить бессмысленно — само не появится.
    const outcome: SendResult = send
      ? await send(messenger.externalId, row.text)
      : {
          ok: false,
          retryable: false,
          error: messenger.ownBot ? 'бот школы не подключён' : 'бот ЕДУДА не подключён',
        }

    const doneAt = clock()

    if (outcome.ok) {
      await db.notificationOutbox.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: doneAt, lastError: null },
      })
      result.sent += 1
      continue
    }

    if (outcome.blocked) {
      // Не ошибка доставки, а отписка: родитель запретил сообщения. Гасим
      // привязку, иначе следующий план снова наберёт ему напоминаний.
      await db.parentMessenger.update({
        where: { id: messenger.id },
        data: { unsubscribedAt: doneAt },
      })
      console.log(`drain: привязка ${messenger.id} погашена — ${outcome.error}`)
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
          : { nextAttemptAt: new Date(doneAt.getTime() + BACKOFF_MS[attempt - 1]!) }),
      },
    })

    if (giveUp) result.failed += 1
    else result.retried += 1
  }

  return result
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
