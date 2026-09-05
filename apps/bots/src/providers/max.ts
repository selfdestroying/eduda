import { env } from '../env'
import type { SendResult } from './vk'

/**
 * MAX Bot API. Три места, где он не такой, как ожидается:
 *
 * 1. Токен идёт заголовком `Authorization: <токен>` — **без** `Bearer`. С
 *    `Bearer` приходит `401 No access token` при живом токене.
 * 2. Личка адресуется `user_id`, а не `chat_id`: `chat_id` из входящего
 *    события в личке даёт `404 chat.not.found`.
 * 3. Подписка на вебхук протухает через восемь часов без успешных ответов, и
 *    молча — поэтому `ensureSubscription` зовётся каждым запуском крона, а не
 *    один раз руками.
 */

const API = 'https://platform-api2.max.ru'

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const max = env.max
  if (!max) throw new Error('MAX не настроен')

  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      // Именно так: без `Bearer`.
      Authorization: max.token,
      'content-type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  })
}

/** `randomId` не используется: своего ключа идемпотентности у MAX нет. */
export async function sendMessage(externalId: string, text: string): Promise<SendResult> {
  let response: Response
  try {
    response = await call(`/messages?user_id=${encodeURIComponent(externalId)}`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  } catch (error) {
    return { ok: false, retryable: true, error: `сеть: ${String(error)}` }
  }

  if (response.ok) return { ok: true }

  // Бот заблокирован или диалога больше нет — это отписка, а не сбой доставки.
  if (response.status === 403 || response.status === 404) {
    return { ok: false, retryable: false, blocked: true, error: `MAX ${response.status}` }
  }

  return {
    ok: false,
    retryable: response.status === 429 || response.status >= 500,
    error: `MAX ${response.status}: ${await response.text().catch(() => '')}`.trim(),
  }
}

/** Кнопка «отправить номер»: единственный способ узнать телефон в MAX. */
export async function askForContact(externalId: string, text: string): Promise<SendResult> {
  try {
    const response = await call(`/messages?user_id=${encodeURIComponent(externalId)}`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        attachments: [
          {
            type: 'inline_keyboard',
            payload: {
              buttons: [[{ type: 'request_contact', text: '📱 Отправить номер' }]],
            },
          },
        ],
      }),
    })
    return response.ok
      ? { ok: true }
      : { ok: false, retryable: false, error: `MAX ${response.status}` }
  } catch (error) {
    return { ok: false, retryable: true, error: `сеть: ${String(error)}` }
  }
}

const UPDATE_TYPES = ['bot_started', 'bot_stopped', 'message_created']

/**
 * Оформляет подписку, если её нет. Сначала читаем список: документация не
 * обещает, что повторный `POST` идемпотентен, а вторая подписка на тот же
 * адрес означала бы каждое событие дважды.
 *
 * Возвращает, что сделала — это единственный след в ответе крона, по которому
 * видно, что подписка была потеряна и восстановлена.
 */
export async function ensureSubscription(): Promise<'есть' | 'оформлена' | 'не настроен' | string> {
  const max = env.max
  if (!max) return 'не настроен'

  try {
    const listed = await call('/subscriptions')
    if (listed.ok) {
      const body = (await listed.json()) as { subscriptions?: { url?: string }[] }
      if (body.subscriptions?.some((item) => item.url === max.webhookUrl)) return 'есть'
    }

    const created = await call('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        url: max.webhookUrl,
        update_types: UPDATE_TYPES,
        secret: max.secret,
      }),
    })

    return created.ok ? 'оформлена' : `не удалась: MAX ${created.status}`
  } catch (error) {
    return `не удалась: ${String(error)}`
  }
}

/**
 * Меню команд бота. Имя без слэша — MAX дорисовывает его сам, как и Telegram,
 * с которого списан этот кусок API.
 */
const COMMANDS = [
  { name: 'cabinet', description: 'Личный кабинет: расписание и оплаты' },
  { name: 'stop', description: 'Отключить напоминания' },
  { name: 'resume', description: 'Включить напоминания обратно' },
]

/**
 * Меню команд живёт в профиле бота и не протухает, поэтому ставится один раз
 * за запуск процесса, а не каждым проходом крона, как подписка.
 *
 * Ошибку только пишем в лог: бот без меню работает, а падать на старте из-за
 * недоступного MAX значит уронить заодно и VK-половину.
 */
export async function ensureCommands(): Promise<void> {
  if (!env.max) return

  try {
    const response = await call('/me', {
      method: 'PATCH',
      body: JSON.stringify({ commands: COMMANDS }),
    })
    if (!response.ok) {
      console.error(`max: меню команд не обновилось — MAX ${response.status}`)
    }
  } catch (error) {
    console.error('max: меню команд не обновилось', error)
  }
}
