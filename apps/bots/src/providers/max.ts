import { env } from '../env'
import type { SendResult } from './vk'

/**
 * MAX Bot API. Четыре места, где он не такой, как ожидается:
 *
 * 1. Токен идёт заголовком `Authorization: <токен>` — **без** `Bearer`. С
 *    `Bearer` приходит `401 No access token` при живом токене.
 * 2. Личка адресуется `user_id`, а не `chat_id`: `chat_id` из входящего
 *    события в личке даёт `404 chat.not.found`.
 * 3. Подписка на вебхук протухает через восемь часов без успешных ответов, и
 *    молча — поэтому `ensureSubscription` зовётся каждым запуском крона, а не
 *    один раз руками.
 * 4. Список типов событий у подписки — часть самой подписки, а не настройка
 *    бота. Дописать тип в `UPDATE_TYPES` мало: у живой подписки останется
 *    прежний набор, и события нового типа просто не придут — тоже молча.
 *    Поэтому `ensureSubscription` сверяет набор и переоформляет подписку.
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

// ─── Кнопки ─────────────────────────────────────────────────────────

/**
 * Кнопки, которые бот вообще умеет. `callback` возвращается событием
 * `message_callback` с этим же `payload`; `request_contact` — единственный
 * способ узнать телефон.
 */
export type Button =
  | { type: 'callback'; text: string; payload: string; intent?: 'positive' | 'negative' }
  | { type: 'request_contact'; text: string }

/** Значения `payload`: короткие и постоянные — они уезжают наружу и приезжают обратно. */
export const STOP = 'stop'
export const RESUME = 'resume'

const CONTACT: Button = { type: 'request_contact', text: '📱 Отправить номер' }
export const STOP_BUTTON: Button = { type: 'callback', text: '🔕 Не напоминать', payload: STOP }
export const RESUME_BUTTON: Button = { type: 'callback', text: '🔔 Вернуть', payload: RESUME }

/** Одна строка кнопок: больше одной здесь пока не нужно ни в одном сообщении. */
function keyboard(buttons: Button[]) {
  return [{ type: 'inline_keyboard', payload: { buttons: [buttons] } }]
}

/** Тело сообщения — общее для отправки и для ответа на нажатие. */
function messageBody(text: string, buttons?: Button[]) {
  return { text, ...(buttons && { attachments: keyboard(buttons) }) }
}

// ─── Отправка ───────────────────────────────────────────────────────

/** `randomId` не используется: своего ключа идемпотентности у MAX нет. */
export async function sendMessage(
  externalId: string,
  text: string,
  buttons?: Button[],
): Promise<SendResult> {
  let response: Response
  try {
    response = await call(`/messages?user_id=${encodeURIComponent(externalId)}`, {
      method: 'POST',
      body: JSON.stringify(messageBody(text, buttons)),
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
export function askForContact(externalId: string, text: string): Promise<SendResult> {
  return sendMessage(externalId, text, [CONTACT])
}

/**
 * Напоминание — с кнопкой отписки. Она висит на каждом, и это не шум: кнопка
 * одна, она внутри сообщения, которое родитель и так читает, а нажатие не
 * добавляет в чат ничего — `answerCallback` правит это же сообщение.
 *
 * Момент, когда родителю надоели напоминания, — это момент, когда напоминание
 * пришло. Отписка обязана быть здесь, а не в меню, которое ещё надо вспомнить.
 */
export function sendReminder(externalId: string, text: string): Promise<SendResult> {
  return sendMessage(externalId, text, [STOP_BUTTON])
}

/**
 * Ответ на нажатие: заменяет то самое сообщение, на котором нажали, — поэтому
 * переписка от кнопок не растёт ни на строку.
 *
 * Зовётся ПОСЛЕ записи в базу: отписка не должна зависеть от того, дошёл ли
 * косметический ответ. Не дошёл — родитель увидит прежнюю кнопку, но отписан
 * уже будет.
 */
export async function answerCallback(
  callbackId: string,
  text: string,
  buttons?: Button[],
): Promise<SendResult> {
  try {
    const response = await call(`/answers?callback_id=${encodeURIComponent(callbackId)}`, {
      method: 'POST',
      body: JSON.stringify({ message: messageBody(text, buttons) }),
    })
    return response.ok
      ? { ok: true }
      : {
          ok: false,
          retryable: false,
          error: `MAX ${response.status}: ${await response.text().catch(() => '')}`.trim(),
        }
  } catch (error) {
    return { ok: false, retryable: true, error: `сеть: ${String(error)}` }
  }
}

// ─── Подписка и меню ────────────────────────────────────────────────

const UPDATE_TYPES = ['bot_started', 'bot_stopped', 'message_created', 'message_callback']

/**
 * Оформляет подписку, если её нет или если у неё не тот набор событий.
 *
 * Сначала читаем список: документация не обещает, что повторный `POST`
 * идемпотентен, а вторая подписка на тот же адрес означала бы каждое событие
 * дважды. Набор сверяем как множество — порядок MAX не хранит.
 *
 * Возвращает, что сделала: это единственный след в ответе крона, по которому
 * видно, что подписка была потеряна и восстановлена.
 */
export async function ensureSubscription(): Promise<string> {
  const max = env.max
  if (!max) return 'не настроен'

  try {
    const listed = await call('/subscriptions')
    if (listed.ok) {
      const listing = (await listed.json()) as {
        subscriptions?: { url?: string; update_types?: string[] }[]
      }
      const current = listing.subscriptions?.find((item) => item.url === max.webhookUrl)

      if (current && sameTypes(current.update_types)) return 'есть'

      // Набор устарел. Обновить подписку нечем — только снять и завести заново;
      // порядок именно такой, иначе рискуем получить две на один адрес.
      if (current) {
        await call(`/subscriptions?url=${encodeURIComponent(max.webhookUrl)}`, { method: 'DELETE' })
      }
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

function sameTypes(types: string[] | undefined): boolean {
  if (!types) return false
  const have = new Set(types)
  return have.size === UPDATE_TYPES.length && UPDATE_TYPES.every((type) => have.has(type))
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
